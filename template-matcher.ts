import { readFileSync } from 'fs';
import { join } from 'path';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  matchKeywords: string[];
  screens: string[];
  isPremiumOnly: boolean;
  estimatedUsers: string;
  prompt: string;
}

interface GoldenScreen {
  name: string;
  html: string;
}

interface GoldenTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  screens: GoldenScreen[];
}

interface MatchResult {
  template: Template;
  confidence: number;
  isGolden: boolean;
}

const GOLDEN_IDS = new Set([
  'expense-tracker',
  'habit-tracker',
  'fitness-tracker',
  'notes-app',
  'todo-app',
]);

let _templates: Template[] | null = null;

function getTemplates(): Template[] {
  if (!_templates) {
    const raw = readFileSync(
      join(__dirname, 'templates/data/premium-templates.json'),
      'utf-8'
    );
    _templates = JSON.parse(raw) as Template[];
  }
  return _templates;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text).split(' ').filter(Boolean);
}

function scoreTemplate(userPrompt: string, template: Template): number {
  const prompt = normalize(userPrompt);
  const promptTokens = tokenize(userPrompt);
  let score = 0;
  let maxPossible = 0;

  // Exact keyword phrase match (highest weight)
  for (const keyword of template.matchKeywords) {
    const nk = normalize(keyword);
    maxPossible += 3;
    if (prompt.includes(nk)) {
      score += 3;
    } else {
      // Partial: check if all tokens of keyword are in prompt
      const kTokens = nk.split(' ');
      const allPresent = kTokens.every((t) => prompt.includes(t));
      if (allPresent && kTokens.length > 1) {
        score += 2;
      } else if (kTokens.some((t) => promptTokens.includes(t))) {
        score += 0.5;
      }
    }
  }

  // Tag match
  for (const tag of template.tags) {
    maxPossible += 1;
    if (promptTokens.includes(tag)) {
      score += 1;
    }
  }

  // Category match
  maxPossible += 2;
  if (prompt.includes(normalize(template.category))) {
    score += 2;
  }

  // Name match
  maxPossible += 2;
  const nameTokens = tokenize(template.name);
  const nameMatches = nameTokens.filter((t) => promptTokens.includes(t)).length;
  score += (nameMatches / nameTokens.length) * 2;

  return maxPossible > 0 ? score / maxPossible : 0;
}

export function matchTemplate(userPrompt: string): MatchResult | null {
  const templates = getTemplates();
  let bestMatch: Template | null = null;
  let bestScore = 0;

  for (const template of templates) {
    const score = scoreTemplate(userPrompt, template);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = template;
    }
  }

  if (!bestMatch || bestScore < 0.15) {
    return null;
  }

  // Normalize confidence to 0-1 range (cap at 1)
  const confidence = Math.min(bestScore * 2.5, 1);

  if (confidence < 0.4) {
    return null;
  }

  return {
    template: bestMatch,
    confidence,
    isGolden: GOLDEN_IDS.has(bestMatch.id),
  };
}

export function getGoldenTemplate(templateId: string): GoldenTemplate | null {
  if (!GOLDEN_IDS.has(templateId)) return null;
  try {
    const raw = readFileSync(
      join(__dirname, `templates/golden/${templateId}.json`),
      'utf-8'
    );
    return JSON.parse(raw) as GoldenTemplate;
  } catch {
    return null;
  }
}

export function getAllTemplates(): Template[] {
  return getTemplates();
}

export function getTemplateById(id: string): Template | undefined {
  return getTemplates().find((t) => t.id === id);
}

export function getTemplatesByCategory(category: string): Template[] {
  return getTemplates().filter((t) => t.category === category);
}
