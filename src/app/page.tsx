'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type PersonType = 'Diego' | 'Kelly' | 'Compartido'

type ExpenseItem = {
  id: string
  person: PersonType
  amount: number
  catId: string
  note: string
  created_at?: string
}

const categories = [
  { id: 'food', name: 'Comida', icon: '🍔' },
  { id: 'transport', name: 'Transporte', icon: '🚗' },
  { id: 'home', name: 'Casa', icon: '🏠' },
  { id: 'fun', name: 'Diversión', icon: '🎉' },
  { id: 'other', name: 'Otros', icon: '📦' },
]

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Home() {
  const [person, setPerson] = useState<PersonType>('Diego')
  const [amount, setAmount] = useState('')
  const [catId, setCatId] = useState('food')
  const [note, setNote] = useState('')
  const [items, setItems] = useState<ExpenseItem[]>([])
  const [loading, setLoading] = useState(true)

  // ===============================
  // LOAD DATA
  // ===============================
  useEffect(() => {
    loadItems()
  }, [])

  const loadItems = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
    } else {
      setItems(data as ExpenseItem[])
    }

    setLoading(false)
  }

  // ===============================
  // SAVE
  // ===============================
  const handleSave = async () => {
    const parsedAmount = Number(amount)

    if (!parsedAmount || parsedAmount <= 0) {
      alert('Ingresa un monto válido')
      return
    }

    const { error } = await supabase.from('expenses').insert([
      {
        person,
        amount: parsedAmount,
        catId,
        note,
      },
    ])

    if (error) {
      console.error(error)
      alert('Error guardando')
      return
    }

    setAmount('')
    setNote('')
    setCatId('food')
    setPerson('Diego')

    await loadItems()
  }

  // ===============================
  // HELPERS
  // ===============================
  const getCategory = (id: string) =>
    categories.find((c) => c.id === id) || categories[4]

  const total = items.reduce((sum, i) => sum + Number(i.amount), 0)

  // ===============================
  // UI
  // ===============================
  return (
    <div style={{ padding: 20, maxWidth: 700, margin: '0 auto' }}>
      <h1>FamFinance 💰</h1>

      {/* PERSONA */}
      <h3>Persona</h3>
      <div style={{ display: 'flex', gap: 10 }}>
        {(['Diego', 'Kelly', 'Compartido'] as PersonType[]).map((p) => (
          <button
            key={p}
            onClick={() => setPerson(p)}
            style={{
              padding: '8px 12px',
              background: person === p ? '#7c5cff' : '#eee',
              color: person === p ? 'white' : 'black',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* MONTO */}
      <h3 style={{ marginTop: 20 }}>Monto</h3>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ padding: 8, width: 200 }}
      />

      {/* CATEGORIA */}
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
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {/* NOTA */}
      <h3 style={{ marginTop: 20 }}>Nota</h3>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={{ padding: 8, width: 300 }}
      />

      {/* SAVE */}
      <div style={{ marginTop: 20 }}>
        <button
          onClick={handleSave}
          style={{
            padding: 10,
            background: 'green',
            color: 'white',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Guardar
        </button>
      </div>

      {/* TOTAL */}
      <div style={{ marginTop: 30 }}>
        <strong>Total: ${total.toLocaleString()}</strong>
      </div>

      {/* LIST */}
      <div style={{ marginTop: 20 }}>
        <h3>Movimientos</h3>

        {loading ? (
          <p>Cargando...</p>
        ) : items.length === 0 ? (
          <p>No hay datos</p>
        ) : (
          items.map((i) => {
            const cat = getCategory(i.catId)
            return (
              <div
                key={i.id}
                style={{
                  marginBottom: 10,
                  padding: 10,
                  border: '1px solid #333',
                  borderRadius: 8,
                }}
              >
                <p>{i.person}</p>
                <p>${Number(i.amount).toLocaleString()}</p>
                <p>
                  {cat.icon} {cat.name}
                </p>
                <p>{i.note}</p>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}