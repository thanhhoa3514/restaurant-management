import { createContext, use, useMemo, useReducer, type ReactNode } from 'react'
import type { CartLine, Screen, Session, Lang } from '../types'

interface OrderingState {
  session: Session | null
  cart: CartLine[]
  screen: Screen
  lang: Lang
  cartOpen: boolean
  placing: boolean
}

type Action =
  | { type: 'SET_SESSION'; payload: Session }
  | { type: 'ADD_TO_CART'; payload: CartLine }
  | { type: 'UPDATE_CART_LINE'; payload: { index: number; line: CartLine } }
  | { type: 'REMOVE_CART_LINE'; payload: number }
  | { type: 'PLACE_ORDER' }
  | { type: 'ORDER_PLACED' }
  | { type: 'PLACE_FAILED' }
  | { type: 'SET_SCREEN'; payload: Screen }
  | { type: 'SET_LANG'; payload: Lang }
  | { type: 'TOGGLE_CART' }
  | { type: 'OPEN_CART' }
  | { type: 'CLOSE_CART' }
  | { type: 'CLEAR_CART' }

function orderingReducer(state: OrderingState, action: Action): OrderingState {
  switch (action.type) {
    case 'SET_SESSION':
      return { ...state, session: action.payload }

    case 'ADD_TO_CART':
      return { ...state, cart: [...state.cart, action.payload] }

    case 'UPDATE_CART_LINE': {
      const cart = [...state.cart]
      cart[action.payload.index] = action.payload.line
      return { ...state, cart }
    }

    case 'REMOVE_CART_LINE':
      return {
        ...state,
        cart: state.cart.filter((_, i) => i !== action.payload),
      }

    case 'PLACE_ORDER':
      return { ...state, placing: true }

    // Server is the source of truth for placed orders; on success we just clear
    // the local cart and let the order screens refetch.
    case 'ORDER_PLACED':
      return { ...state, cart: [], placing: false, cartOpen: false }

    case 'PLACE_FAILED':
      return { ...state, placing: false }

    case 'SET_SCREEN':
      return { ...state, screen: action.payload }

    case 'SET_LANG':
      localStorage.setItem('rest_lang_customer', action.payload)
      return { ...state, lang: action.payload }

    case 'TOGGLE_CART':
      return { ...state, cartOpen: !state.cartOpen }

    case 'OPEN_CART':
      return { ...state, cartOpen: true }

    case 'CLOSE_CART':
      return { ...state, cartOpen: false }

    case 'CLEAR_CART':
      return { ...state, cart: [] }

    default:
      return state
  }
}

interface OrderingContextValue {
  state: OrderingState
  dispatch: React.Dispatch<Action>
}

const OrderingContext = createContext<OrderingContextValue | null>(null)

export function OrderingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(orderingReducer, {
    session: null,
    cart: [],
    screen: 'qr',
    lang: (localStorage.getItem('rest_lang_customer') as Lang) || 'vi',
    cartOpen: false,
    placing: false,
  })

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch])

  return (
    <OrderingContext.Provider value={value}>
      {children}
    </OrderingContext.Provider>
  )
}

export function useOrdering(): OrderingContextValue {
  const ctx = use(OrderingContext)
  if (!ctx) throw new Error('useOrdering must be used within OrderingProvider')
  return ctx
}
