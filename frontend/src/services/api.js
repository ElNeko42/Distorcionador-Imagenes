const BASE_URL = '/api';

export async function analyzeImage(file) {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`${BASE_URL}/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Analysis failed: ${response.statusText}`);
  }

  return response.json();
}
