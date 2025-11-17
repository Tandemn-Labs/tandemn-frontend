import { Suspense } from 'react';
import { getAllModels } from '@/config/models';
import ModelsClient from './models-client';
import ModelsLoading from './loading';

// Server Component - fetches data on the server
async function getModels() {
  try {
    // Fetch directly from the config instead of making an HTTP call
    const models = getAllModels();
    return models;
    } catch (error) {
      console.error('Error fetching models:', error);
    return [];
  }
}

export default async function ModelsPage() {
  // Fetch models on the server
  const models = await getModels();

  return (
    <Suspense fallback={<ModelsLoading />}>
      <ModelsClient initialModels={models} />
    </Suspense>
  );
}