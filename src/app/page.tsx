'use client'

import { useState } from 'react'

type PersonType = 'Diego' | 'Kelly' | 'Compartido'

export default function Home() {
  const [person, setPerson] = useState<PersonType>('Diego')
  const [amount, setAmount] = useState('')

  return (
    <div style={{ padding: 20 }}>
      <h1>FamFinance 🚀</h1>

      <h3>Persona</h3>
      <div>
        {(['Diego', 'Kelly', 'Compartido'] as PersonType[]).map((p) => (
          <button
            key={p}
            onClick={() => setPerson(p)}
            style={{
              marginRight: 10,
              padding: '6px 10px',
              background: person === p ? '#7c5cff' : '#eee',
              color: person === p ? 'white' : 'black',
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
      />

      <p style={{ marginTop: 20 }}>
        Seleccionado: {person} - ${amount}
      </p>
    </div>
  )
}