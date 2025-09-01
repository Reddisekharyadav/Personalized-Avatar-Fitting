export default function SavedLooks() {
  return (
    <div className="min-h-screen p-8">
      <h2 className="text-2xl font-bold mb-4">Saved Looks</h2>
      {/* Saved looks grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {/* Example saved look */}
        <div className="bg-white rounded shadow p-4 flex flex-col items-center">
          <img src="/saved-look-demo.png" alt="Saved Look" className="w-32 h-32 object-contain mb-2" />
          <div className="font-semibold">Look #1</div>
          <button className="mt-2 px-4 py-1 bg-blue-500 text-white rounded">Share</button>
        </div>
      </div>
    </div>
  );
}
