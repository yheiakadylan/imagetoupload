import { User as AuthUser } from './contexts/AuthContext';

export interface Status {
    message: string;
    type: 'ok' | 'err' | 'info' | 'warn';
    visible: boolean;
}

export interface ApiKey {
    id: string;
    name: string;
    key: string;
}

export interface ArtRef {
    id:string;
    name: string;
    dataUrl: string;
    publicId?: string;
    createdAt: number;
}

export interface Sample {
    id: string;
    name: string;
    dataUrl: string;
    publicId?: string;
    createdAt: number;
}

export interface Template {
    id: string;
    name: string;
    prompt: string;
    createdAt: number;
}

// FIX: Added missing CutTemplate interface for die-cut templates.
export interface CutTemplate {
    id: string;
    name: string;
    createdAt: number;
    svgText?: string;
    pngMask?: string;
    pngMaskPublicId?: string;
}

export interface MockupPrompt {
    id: string;
    prompt: string;
}

export interface LogEntry {
    id: string;
    type: 'artwork' | 'mockup';
    prompt: string;
    dataUrl: string;
    //deleteUrl?: string;
    publicId?: string;
    error?: string;
    createdAt: number;
    ownerUid?: string;
}

export interface ExpandedNode {
    id: string;
    sourceId: string;
    dataUrl: string;
    ratioLabel: string;
    position: { x: number; y: number };
}

export interface Job {
  id: string;
  sku: string;
  artworkUrl: string;
  prompts: MockupPrompt[];
  count: number;
  aspectRatio: string;
  model: 'gemini' | 'puter';
  status: 'queued' | 'running' | 'completed' | 'cancelled' | 'error';
  progress: { done: number; total: number };
  results: LogEntry[];
  createdAt: number;
  error?: string;
}


export interface User extends AuthUser {
    etsy_access_token?: string;
}

export interface AppSettings {
    announcementText: string;
    announcementEnabled: boolean;
}
export interface EtsyListingTemplate {
  id: string;
  createdAt: number;
  name: string;
  description: string;
  taxonomyId: number;
  shippingProfileId: number;
  returnPolicyId: number;
  inventory: string;
  
  // New fields for Etsy API requirements
  who_made?: 'i_did' | 'someone_else' | 'collective';
  when_made?: string;
  readiness_state_id?: string; // User requested text input.
}


export interface EtsyDescriptionTemplate {
  id: string;
  createdAt: number;
  name: string;
  content: string;
}