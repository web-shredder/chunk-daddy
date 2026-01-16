-- Add optimized content and optimization result columns to chunk_daddy_projects
ALTER TABLE public.chunk_daddy_projects 
ADD COLUMN IF NOT EXISTS optimized_content TEXT,
ADD COLUMN IF NOT EXISTS optimization_result JSONB;