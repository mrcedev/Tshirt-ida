import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { FREE_SHIPPING_FROM, SHIPPING_FEE, discountFor } from '../lib/pricing'

const STORAGE_KEY = 'inkwave-cart'
const CartContext = createContext(null)

const uid = () => Math.random().toString(36).slice(2, 10)

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? []
  } catch {
    return []
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef()

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // Storage full or blocked – the cart still works for this session.
    }
  }, [items])

  const notify = useCallback((message, cartLink = false) => {
    clearTimeout(toastTimer.current)
    setToast({ message, cartLink, id: uid() })
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  // Accepts one line item or an array (e.g. one custom design ordered in several sizes).
  const add = useCallback(
    (input) => {
      const list = Array.isArray(input) ? input : [input]
      if (list.length === 0) return
      setItems((prev) =>
        list.reduce((acc, item) => {
          // Plain garments with identical options stack; custom designs are always separate lines.
          if (!item.design) {
            const existing = acc.find(
              (i) => !i.design && i.productId === item.productId && i.color === item.color && i.size === item.size,
            )
            if (existing) {
              return acc.map((i) => (i === existing ? { ...i, qty: i.qty + item.qty } : i))
            }
          }
          return [...acc, { ...item, key: uid() }]
        }, prev),
      )
      const qty = list.reduce((s, i) => s + i.qty, 0)
      notify(`Added ${qty} × ${list[0].name} to cart`, true)
    },
    [notify],
  )

  const updateQty = useCallback((key, qty) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, qty: Math.max(1, Math.min(999, qty)) } : i)))
  }, [])

  const remove = useCallback((key) => setItems((prev) => prev.filter((i) => i.key !== key)), [])
  const clear = useCallback(() => setItems([]), [])

  const totals = useMemo(() => {
    const count = items.reduce((s, i) => s + i.qty, 0)
    const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
    const discountRate = discountFor(count)
    const discount = subtotal * discountRate
    const afterDiscount = subtotal - discount
    const shipping = count === 0 || afterDiscount >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE
    return { count, subtotal, discountRate, discount, shipping, total: afterDiscount + shipping }
  }, [items])

  const value = { items, add, updateQty, remove, clear, totals, toast, notify }
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => useContext(CartContext)
