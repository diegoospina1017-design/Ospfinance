'use client'

import { useState } from 'react'

type PersonType = 'Diego' | 'Kelly' | 'Compartido'

type Category = {
  id: string
  name: string
  icon: string
}

type ExpenseItem = {
  id: number
  person: PersonType
  amount: number
  catId: string
  note: string
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
  const [items, setItems] = useState<ExpenseItem[]>([])

  const handleSave = () => {
    const parsedAmount = Number(amount)

    if (!parsedAmount || parsedAmount <= 0) {
      alert('Ingresa un monto válido')
      return
    }

    const newItem: ExpenseItem = {
      id: Date.now(),
      person,
      amount: parsedAmount,
      catId,
      note,
    }

    setItems((prev) => [newItem, ...prev])
    setAmount('')
    setNote('')
    setCatId('food')
    setPerson('Diego')
  }

  const getCategoryName = (id: string) => {
    return categories.find((c) => c.id === id)?.name || 'Sin categoría'
  }

  const getCategoryIcon = (id: string) => {
    return categories.find((c) => c.id === id)?.icon || '📦'
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0)

  return (
    <div style={{ padding: 20, maxWidth: 700, margin: '0 auto' }}>
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

      <div style={{ marginTop: 20 }}>
        <button
          onClick={handleSave}
          style={{
            padding: '10px 16px',
            background: '#16a34a',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Guardar gasto
        </button>
      </div>

      <div style={{ marginTop: 30 }}>
        <strong>Total acumulado:</strong> ${total.toLocaleString()}
      </div>

      <div style={{ marginTop: 30 }}>
        <h3>Movimientos</h3>

        {items.length === 0 ? (
          <p>No hay movimientos todavía.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: 14,
                  border: '1px solid #333',
                  borderRadius: 10,
                  background: '#111',
                }}
              >
                <p><strong>Persona:</strong> {item.person}</p>
                <p><strong>Monto:</strong> ${item.amount.toLocaleString()}</p>
                <p>
                  <strong>Categoría:</strong> {getCategoryIcon(item.catId)} {getCategoryName(item.catId)}
                </p>
                <p><strong>Nota:</strong> {item.note || '-'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}