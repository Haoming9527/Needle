import { z } from 'zod';
import { publicImageUrl } from '../providers/evidence.js';

const preferenceSchema = z.object({
  budget: z.number().finite().nonnegative().max(1_000_000_000).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
}).strict();

const imageDataSchema = z.string()
  .max(6_000_000)
  .regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/);

const selectionSchema = z.object({
  text: z.string().max(4000).optional(),
  imageDataUrl: imageDataSchema.optional(),
  annotatedImageDataUrl: imageDataSchema.optional(),
  focus: z.object({
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
  }).strict().optional(),
  clarifications: z.array(z.object({
    question: z.string().trim().min(1).max(500),
    answer: z.string().trim().min(1).max(1000),
  }).strict()).max(5).optional(),
  imageUrl: z.string().max(5000)
    .refine(value => !!publicImageUrl(value), 'Use a public HTTPS image URL.')
    .optional(),
  pageUrl: z.string().max(5000).url().optional(),
  pageTitle: z.string().max(500).optional(),
  capturedAt: z.string().max(50).optional(),
}).strict()
  .refine(
    value => !!value.text?.trim() || !!value.imageDataUrl || !!value.imageUrl,
    'Select an image or text, or add a description.',
  )
  .refine(
    value => !value.annotatedImageDataUrl || (!!value.imageDataUrl && !!value.focus),
    'A marked image requires the original crop and cursor position.',
  );

export const discoverSchema = z.object({
  selection: selectionSchema,
  preferences: preferenceSchema.optional(),
  mode: z.enum(['sample', 'live']).optional(),
}).strict();

export const refineSchema = z.object({
  sessionId: z.string().uuid(),
  instruction: z.string().trim().min(1).max(1000),
  preferences: preferenceSchema.optional(),
}).strict();

export const clarifySchema = z.object({
  sessionId: z.string().uuid(),
  answer: z.string().trim().min(1).max(1000),
  selection: selectionSchema,
}).strict();

export const orderSchema = z.object({
  sessionId: z.string().uuid(),
  offerId: z.string().min(1).max(100),
  variant: z.string().min(1).max(100).optional(),
  confirmationId: z.string().min(8).max(100),
  confirmed: z.literal(true),
  cartItemId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(99).optional(),
}).strict();

export const cartSchema = z.object({
  sessionId: z.string().uuid(),
  offerId: z.string().min(1).max(100),
  variant: z.string().min(1).max(100).optional(),
  quantity: z.number().int().min(1).max(99).optional(),
  operationId: z.string().min(8).max(100).optional(),
}).strict();

export const clearSchema = z.object({}).strict();
export const cartItemIdSchema = z.string().uuid();
export const cartQuantitySchema = z.object({
  quantity: z.number().int().min(1).max(99),
}).strict();
