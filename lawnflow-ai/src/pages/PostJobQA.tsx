import React, { useEffect, useState } from 'react';

const PostJobQA: React.FC = () => {
  const [postJobQAs, setPostJobQAs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPostJobQAs = async () => {
      try {
        const response = await fetch('/api/post-job-qa');
        if (!response.ok) {
          throw new Error('Failed to fetch post-job-qas');
        }
        const data = await response.json();
        setPostJobQAs(data.postJobQAs);
      } catch (error: any) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPostJobQAs();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Post-Job QA</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">ID</th>
              <th className="py-2 px-4 border-b">Job ID</th>
              <th className="py-2 px-4 border-b">Customer</th>
              <th className="py-2 px-4 border-b">Status</th>
              <th className="py-2 px-4 border-b">Rating</th>
            </tr>
          </thead>
          <tbody>
            {postJobQAs.map((qa) => (
              <tr key={qa.id}>
                <td className="py-2 px-4 border-b">{qa.id}</td>
                <td className="py-2 px-4 border-b">{qa.jobId}</td>
                <td className="py-2 px-4 border-b">{qa.customerName}</td>
                <td className="py-2 px-4 border-b">{qa.status}</td>
                <td className="py-2 px-4 border-b">{qa.starRating || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PostJobQA;
