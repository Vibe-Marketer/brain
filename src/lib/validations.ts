import { z } from 'zod';

// Category validation
export const categorySchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Category name is required')
    .max(100, 'Category name must be less than 100 characters'),
  description: z.string()
    .trim()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .or(z.literal('')),
});

// Speaker validation
export const speakerSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  email: z.string()
    .trim()
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters')
    .optional()
    .or(z.literal('')),
  title: z.string()
    .trim()
    .max(100, 'Title must be less than 100 characters')
    .optional()
    .or(z.literal('')),
  company: z.string()
    .trim()
    .max(100, 'Company must be less than 100 characters')
    .optional()
    .or(z.literal('')),
  notes: z.string()
    .trim()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional()
    .or(z.literal('')),
});

// Search query validation
export const searchQuerySchema = z.string()
  .trim()
  .max(200, 'Search query too long');

// API configuration validation (for edge functions)
export const apiKeySchema = z.object({
  apiKey: z.string()
    .trim()
    .min(20, 'API key appears to be invalid (too short)')
    .max(500, 'API key too long')
});

export const webhookSecretSchema = z.object({
  secret: z.string()
    .trim()
    .min(10, 'Webhook secret appears to be invalid')
    .max(500, 'Webhook secret too long')
});

export const hostEmailSchema = z.object({
  email: z.string()
    .trim()
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters')
    .toLowerCase()
});
