export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'user' | 'admin' | 'super_admin'
export type SpaceType = 'hot_desk' | 'private_office' | 'meeting_room'
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'
export type DurationType = 'hourly' | 'daily' | 'monthly'
export type MembershipPlan = 'day_pass' | 'monthly' | 'private_office'
export type MembershipStatus = 'active' | 'expired' | 'cancelled' | 'pending'
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded'
export type PaymentMethod = 'credit_card' | 'debit_card' | 'bank_transfer' | 'fpx' | 'ewallet'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          email: string | null
          phone: string | null
          company: string | null
          avatar_url: string | null
          role: UserRole
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          email?: string | null
          phone?: string | null
          company?: string | null
          avatar_url?: string | null
          role?: UserRole
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          email?: string | null
          phone?: string | null
          company?: string | null
          avatar_url?: string | null
          role?: UserRole
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      spaces: {
        Row: {
          id: string
          name: string
          type: SpaceType
          description: string | null
          capacity: number
          hourly_rate: number | null
          daily_rate: number | null
          monthly_rate: number | null
          location: string
          floor: string | null
          amenities: string[]
          image_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: SpaceType
          description?: string | null
          capacity?: number
          hourly_rate?: number | null
          daily_rate?: number | null
          monthly_rate?: number | null
          location?: string
          floor?: string | null
          amenities?: string[]
          image_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: SpaceType
          description?: string | null
          capacity?: number
          hourly_rate?: number | null
          daily_rate?: number | null
          monthly_rate?: number | null
          location?: string
          floor?: string | null
          amenities?: string[]
          image_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      bookings: {
        Row: {
          id: string
          user_id: string
          space_id: string
          start_time: string
          end_time: string
          duration_type: DurationType
          status: BookingStatus
          total_amount: number
          attendees_count: number
          notes: string | null
          special_requirements: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          space_id: string
          start_time: string
          end_time: string
          duration_type: DurationType
          status?: BookingStatus
          total_amount: number
          attendees_count?: number
          notes?: string | null
          special_requirements?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          space_id?: string
          start_time?: string
          end_time?: string
          duration_type?: DurationType
          status?: BookingStatus
          total_amount?: number
          attendees_count?: number
          notes?: string | null
          special_requirements?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      memberships: {
        Row: {
          id: string
          user_id: string
          plan_type: MembershipPlan
          start_date: string
          end_date: string
          status: MembershipStatus
          auto_renew: boolean
          price: number
          meeting_room_hours_included: number
          meeting_room_hours_used: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan_type: MembershipPlan
          start_date: string
          end_date: string
          status?: MembershipStatus
          auto_renew?: boolean
          price: number
          meeting_room_hours_included?: number
          meeting_room_hours_used?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan_type?: MembershipPlan
          start_date?: string
          end_date?: string
          status?: MembershipStatus
          auto_renew?: boolean
          price?: number
          meeting_room_hours_included?: number
          meeting_room_hours_used?: number
          created_at?: string
          updated_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          user_id: string
          booking_id: string | null
          membership_id: string | null
          amount: number
          currency: string
          payment_method: PaymentMethod | null
          payment_status: PaymentStatus
          transaction_id: string | null
          payment_provider: string | null
          receipt_url: string | null
          paid_at: string | null
          refunded_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          booking_id?: string | null
          membership_id?: string | null
          amount: number
          currency?: string
          payment_method?: PaymentMethod | null
          payment_status?: PaymentStatus
          transaction_id?: string | null
          payment_provider?: string | null
          receipt_url?: string | null
          paid_at?: string | null
          refunded_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          booking_id?: string | null
          membership_id?: string | null
          amount?: number
          currency?: string
          payment_method?: PaymentMethod | null
          payment_status?: PaymentStatus
          transaction_id?: string | null
          payment_provider?: string | null
          receipt_url?: string | null
          paid_at?: string | null
          refunded_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
