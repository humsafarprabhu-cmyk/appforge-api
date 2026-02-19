/**
 * Storage Service — file upload/download via Supabase Storage.
 */
import { supabase } from '../middleware/auth.ts';
import { randomUUID } from 'crypto';
import path from 'path';

const BUCKET = 'app-uploads';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'text/plain', 'text/csv',
  'application/json',
  'audio/mpeg', 'audio/wav',
  'video/mp4',
];

export async function uploadFile(
  appId: string,
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  userId?: string,
  purpose: string = 'general'
) {
  // Validate size
  if (file.size > MAX_FILE_SIZE) {
    throw Object.assign(new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`), { status: 400 });
  }

  // Validate type
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    throw Object.assign(new Error(`File type not allowed: ${file.mimetype}`), { status: 400 });
  }

  // Generate unique path
  const ext = path.extname(file.originalname) || '';
  const filePath = `${appId}/${purpose}/${randomUUID()}${ext}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });
  if (uploadError) throw uploadError;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(filePath);

  // Record in app_files
  const { data: record, error: dbError } = await supabase
    .from('app_files')
    .insert({
      app_id: appId,
      end_user_id: userId || null,
      file_name: file.originalname,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.mimetype,
      purpose,
      public_url: urlData.publicUrl,
    })
    .select('id, file_name, file_path, file_size, mime_type, purpose, public_url, created_at')
    .single();
  if (dbError) throw dbError;

  return record;
}

export async function listFiles(appId: string, opts: { purpose?: string; userId?: string; limit?: number; offset?: number }) {
  let query = supabase
    .from('app_files')
    .select('id, file_name, file_path, file_size, mime_type, purpose, public_url, end_user_id, created_at', { count: 'exact' })
    .eq('app_id', appId);

  if (opts.purpose) query = query.eq('purpose', opts.purpose);
  if (opts.userId) query = query.eq('end_user_id', opts.userId);

  const limit = opts.limit || 100;
  const offset = opts.offset || 0;

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;

  return {
    files: data || [],
    total: count || 0,
    limit,
    offset,
    hasMore: (offset + limit) < (count || 0),
  };
}

export async function deleteFile(appId: string, fileId: string) {
  // Get file path first
  const { data: file } = await supabase
    .from('app_files')
    .select('file_path')
    .eq('id', fileId)
    .eq('app_id', appId)
    .single();
  if (!file) throw Object.assign(new Error('File not found'), { status: 404 });

  // Delete from storage
  await supabase.storage.from(BUCKET).remove([file.file_path]);

  // Delete record
  await supabase
    .from('app_files')
    .delete()
    .eq('id', fileId)
    .eq('app_id', appId);

  return { success: true };
}
