import { supabase } from '@/integrations/supabase/client';

export interface FetchedContent {
  success: boolean;
  title: string;
  content: string;
  markdown: string;
  sourceUrl: string;
  fetchedAt: string;
}

export async function fetchUrlContent(url: string): Promise<FetchedContent> {
  const { data, error } = await supabase.functions.invoke('fetch-url-content', {
    body: { url },
  });

  if (error) {
    throw new Error(error.message || 'Failed to fetch URL content');
  }

  if (!data.success) {
    throw new Error(data.error || 'Failed to parse URL content');
  }

  return data;
}
