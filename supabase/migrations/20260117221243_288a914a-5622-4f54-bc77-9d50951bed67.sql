-- Add architecture_analysis column to chunk_daddy_projects table
ALTER TABLE public.chunk_daddy_projects
ADD COLUMN architecture_analysis JSONB DEFAULT NULL;