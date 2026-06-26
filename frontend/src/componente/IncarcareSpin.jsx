export default function IncarcareSpin({ mesaj = 'Se încarcă...' }) {
  return (
    <div className="min-h-screen bg-fundal flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block w-10 h-10 border-4 border-primar-200 border-t-primar-500 rounded-full animate-spin mb-4" />
        <p className="text-text-secundar font-medium text-sm">{mesaj}</p>
      </div>
    </div>
  )
}
