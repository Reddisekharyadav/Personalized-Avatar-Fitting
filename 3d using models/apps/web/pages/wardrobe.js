export default function Wardrobe() {
  return (
    <div className="min-h-screen p-8">
      <h2 className="text-2xl font-bold mb-4">Wardrobe</h2>
      {/* Garment grid will be rendered here */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {/* Example garment card */}
        <div className="bg-white rounded shadow p-4 flex flex-col items-center">
          <img src="/garment-demo.png" alt="Garment" className="w-32 h-32 object-contain mb-2" />
          <div className="font-semibold">Demo Tee</div>
          <button className="mt-2 px-4 py-1 bg-blue-500 text-white rounded">Try On</button>
        </div>
      </div>
    </div>
  );
}
