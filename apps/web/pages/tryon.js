export default function TryOn() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h2 className="text-2xl font-bold mb-4">Try-On Viewer</h2>
      {/* Avatar and garment preview */}
      <div className="bg-white rounded shadow p-8 flex flex-col items-center">
        <img src="/avatar-demo.png" alt="Avatar" className="w-48 h-48 mb-4" />
        <img src="/garment-demo.png" alt="Garment" className="w-32 h-32 mb-2" />
        <button className="mt-4 px-6 py-2 bg-green-600 text-white rounded">Save Look</button>
      </div>
    </div>
  );
}
