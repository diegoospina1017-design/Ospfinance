'use client'

import { useState } from 'react'

type PersonType = 'Diego' | 'Kelly' | 'Compartido'

type Category = {
  id: string
  name: string
  icon: string
}

const categories: Category[] = [
  { id: 'food', name: 'Comida', icon: '🍔' },
  { id: 'transport', name: 'Transporte', icon: '🚗' },
  { id: 'home', name: 'Casa', icon: '🏠' },
  { id: 'fun', name: 'Diversión', icon: '🎉' },
  { id: 'other', name: 'Otros', icon: '📦' },
]

export default function Home() {
  const [person, setPerson] = useState<PersonType>('Diego')
  const [amount, setAmount] = useState('')
  const [catId, setCatId] = useState('food')
  const [note, setNote] = useState('')

  return (
    <div style={{ padding: 20 }}>
      <h1>FamFinance 🚀</h1>

      <h3>Persona</h3>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {(['Diego', 'Kelly', 'Compartido'] as PersonType[]).map((p) => (
          <button
            key={p}
            onClick={() => setPerson(p)}
            style={{
              padding: '8px 12px',
              background: person === p ? '#7c5cff' : '#eee',
              color: person === p ? 'white' : 'black',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      <h3 style={{ marginTop: 20 }}>Monto</h3>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Ej: 50000"
        style={{ padding: 8, width: 250 }}
      />

      <h3 style={{ marginTop: 20 }}>Categoría</h3>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCatId(c.id)}
            style={{
              padding: '8px 12px',
              background: catId === c.id ? '#7c5cff' : '#eee',
              color: catId === c.id ? 'white' : 'black',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      <h3 style={{ marginTop: 20 }}>Nota</h3>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Ej: mercado, gasolina..."
        style={{ padding: 8, width: 300 }}
      />

      <div style={{ marginTop: 30 }}>
        <strong>Resumen:</strong>
        <p>Persona: {person}</p>
        <p>Monto: {amount || '0'}</p>
        <p>
          Categoría:{' '}
          {categories.find((c) => c.id === catId)?.name}
        </p>
        <p>Nota: {note || '-'}</p>
      </div>
    </div>
  )
}