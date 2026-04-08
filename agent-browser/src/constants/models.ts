import type { HFModel } from '@/types';

export const SEED_MODELS: HFModel[] = [
  {
    id: 'onnx-community/Qwen3-0.6B-ONNX',
    name: 'Qwen3 0.6B',
    author: 'onnx-community',
    task: 'text-generation',
    downloads: 15234,
    likes: 89,
    tags: ['onnx', 'text-generation'],
    sizeMB: 620,
    status: 'available',
  },
  {
    id: 'onnx-community/Qwen2.5-0.5B-Instruct',
    name: 'Qwen2.5 0.5B Instruct',
    author: 'onnx-community',
    task: 'text-generation',
    downloads: 8921,
    likes: 45,
    tags: ['onnx', 'text-generation'],
    sizeMB: 450,
    status: 'available',
  },
  {
    id: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
    name: 'DistilBERT SST-2',
    author: 'Xenova',
    task: 'text-classification',
    downloads: 234567,
    likes: 312,
    tags: ['onnx', 'text-classification'],
    sizeMB: 67,
    status: 'available',
  },
  {
    id: 'Xenova/all-MiniLM-L6-v2',
    name: 'All-MiniLM-L6',
    author: 'Xenova',
    task: 'feature-extraction',
    downloads: 567890,
    likes: 890,
    tags: ['onnx', 'feature-extraction'],
    sizeMB: 23,
    status: 'available',
  },
];

export const HF_TASKS = [
  'text-generation',
  'text-classification',
  'question-answering',
  'feature-extraction',
  'translation',
  'summarization',
] as const;

export type HFTask = (typeof HF_TASKS)[number];
