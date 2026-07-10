export type TableStatus = 'available' | 'occupied' | 'reserved'

export interface RestaurantTable {
  id: number
  status: TableStatus
  detail?: string
}

export interface OrderItem {
  qty: number
  name: string
  price: number
}

export interface Promo {
  id: string
  name: string
  type: 'persentase' | 'nominal'
  value: number
  active: boolean
}

export const tables: RestaurantTable[] = [
  { id: 1, status: 'available' },
  { id: 2, status: 'occupied', detail: '3 tamu' },
  { id: 3, status: 'available' },
  { id: 4, status: 'reserved', detail: '19.00' },
  { id: 5, status: 'available' },
  { id: 6, status: 'occupied', detail: '2 tamu' },
  { id: 7, status: 'available' },
  { id: 8, status: 'occupied', detail: '5 tamu' },
  { id: 9, status: 'available' },
  { id: 10, status: 'available' },
  { id: 11, status: 'available' },
  { id: 12, status: 'available' },
]

export const sampleOrder: OrderItem[] = [
  { qty: 2, name: 'Nasi Goreng Spesial', price: 28_000 },
  { qty: 1, name: 'Ayam Bakar Madu', price: 32_000 },
  { qty: 2, name: 'Es Teh Manis', price: 8_000 },
]

export const initialPromos: Promo[] = [
  { id: '1', name: 'Diskon Pembukaan', type: 'persentase', value: 10, active: true },
]

export const shiftHistory = [
  { id: '1', date: '5 Jul', time: '09:39 – 14:57', value: -281_560 },
  { id: '2', date: '5 Jul', time: '05:27 – 06:23', value: 810_000 },
  { id: '3', date: '5 Jul', time: '05:24 – 12:25', value: 8_100_000 },
  { id: '4', date: '4 Jul', time: '16:43 – 12:24', value: 89_640_480 },
  { id: '5', date: '3 Jul', time: '11:04 – 23:38', value: 866_400 },
  { id: '6', date: '2 Jul', time: '13:50 – 21:36', value: 706_360 },
  { id: '7', date: '2 Jul', time: '08:17 – 20:50', value: 47_000 },
  { id: '8', date: '1 Jul', time: '15:22 – 22:22', value: 700_000 },
]

export const rupiah = (amount: number) => `Rp ${Math.abs(amount).toLocaleString('id-ID')}`
