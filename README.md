# Infinity8 - Smart Coworking Space Platform

A comprehensive, AI-powered coworking space management platform for Infinity8, Malaysia's premier coworking space company. Built with Next.js, FastAPI, and powered by advanced AI agents.

## 🎯 Overview

Infinity8 is a full-stack platform that combines beautiful user-facing features with powerful admin tools, all enhanced by AI capabilities including natural language booking, intelligent chatbots, and RAG-powered knowledge management.

## ✨ Key Features

### 🌐 User-Facing Features

#### Landing Page & Booking
- **Modern Design**: Responsive landing page with hero section, workspace solutions, amenities, and pricing
- **AI Booking Agent**: Natural language booking system - just describe what you need
- **Voice Support**: Speech-to-text booking with ElevenLabs integration
- **Payment Integration**: Secure Stripe checkout with automatic email confirmations
- **Multi-location Support**: Kuala Lumpur, Petaling Jaya, and Johor Bahru

#### AI Chatbot 🤖
- **Intelligent Q&A**: Answers questions about pricing, amenities, locations, and more
- **RAG-Powered**: Knowledge base backed by vector embeddings for accurate responses
- **Voice Interaction**: Text-to-speech and speech-to-text capabilities
- **Context-Aware**: Maintains conversation history for natural interactions
- **Quick Actions**: Pre-defined queries for common questions
- **Markdown Support**: Properly formatted responses with links, bold, and italic text

#### User Dashboard
- **Booking Management**: View and manage all bookings
- **Payment History**: Track payments and receipts
- **Profile Management**: Update account information
- **Authentication**: Secure login/signup with Supabase Auth

### 🔧 Admin Panel Features

#### Dashboard
- **Admin AI Assistant**: Dedicated chatbot for booking queries and data analysis
- **Real-time Statistics**: Overview of bookings, revenue, and space utilization
- **Quick Actions**: Access to key administrative functions

#### Bookings Management
- **Comprehensive View**: See all bookings with detailed information
- **Booking Details Modal**: View customer info, space details, payment status
- **Status Management**: Confirm, cancel, or modify bookings
- **Search & Filter**: Find bookings by date, user, space, or status

#### Spaces Management
- **Space Status Grid**: Real-time availability across all locations
- **Utilization Analytics**: Charts and graphs showing space usage patterns
- **Booking Timeline**: Visual timeline of space reservations
- **Space Type Distribution**: Analysis of workspace preferences
- **Availability Dashboard**: Track occupancy rates and trends

#### Knowledge Base (RAG System)
- **Document Upload**: Upload PDFs, docs, and text files
- **Vector Embeddings**: Automatic processing with OpenAI embeddings
- **Semantic Search**: Find relevant information across all documents
- **Unanswered Queries**: Track and address questions the AI couldn't answer
- **Knowledge Management**: Update, delete, and organize knowledge base content

## 🏗️ Architecture

### Frontend Stack
- **Framework**: Next.js 16.0.7 (App Router)
- **UI Library**: React 19.2.0
- **Styling**: Tailwind CSS 4
- **Language**: TypeScript 5
- **Authentication**: Supabase Auth
- **Maps**: Google Maps JavaScript API
- **Voice**: ElevenLabs for TTS

### Backend Stack
- **Framework**: FastAPI
- **AI Agent**: LangGraph with LangChain
- **LLM**: OpenAI GPT models
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe + Stripe Agent Toolkit
- **Email**: Resend
- **PDF Generation**: FPDF2
- **QR Codes**: Segno

### AI & ML
- **LangGraph**: Orchestrates multi-step AI agent workflows
- **LangChain**: Tool calling, prompt management, and chains
- **RAG**: Vector embeddings with pgvector for knowledge retrieval
- **OpenAI**: GPT-4 for natural language understanding
- **Embeddings**: text-embedding-ada-002 for semantic search

## 📦 Installation & Setup

### Prerequisites
- Node.js 20+ and npm
- Python 3.11+
- Supabase account
- OpenAI API key
- Stripe account
- Resend account (for emails)

### Frontend Setup

1. **Clone and install dependencies**
```bash
git clone <repository-url>
cd geco01
npm install
```

2. **Configure environment variables**
Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

3. **Run the development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Backend Setup

1. **Navigate to backend directory**
```bash
cd backend
```

2. **Create virtual environment**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Configure environment variables**
Create `.env` in the `backend/` directory:
```env
# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Email
RESEND_API_KEY=your_resend_api_key
RESEND_FROM=noreply@yourdomain.com

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

5. **Run the backend server**
```bash
uvicorn app.main:app --reload
```

API will be available at [http://localhost:8000](http://localhost:8000)

### Database Setup

1. **Create Supabase project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project

2. **Run migrations**
```bash
# Apply migrations in order
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_add_stripe_customer_and_spaces.sql
supabase/migrations/003_knowledge_base_rag.sql
supabase/migrations/004_create_knowledge_base_bucket.sql
```

3. **Enable pgvector extension**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## 📁 Project Structure

```
geco01/
├── app/                                 # Next.js frontend
│   ├── admin/                          # Admin panel
│   │   ├── dashboard/                  # Admin dashboard with AI assistant
│   │   ├── bookings/                   # Booking management
│   │   ├── spaces/                     # Space analytics & management
│   │   └── knowledge-base/             # RAG knowledge base management
│   ├── api/                            # Next.js API routes
│   │   ├── chat/                       # User chatbot API
│   │   ├── admin/chat/                 # Admin chatbot API
│   │   ├── speech-to-text/             # Voice input processing
│   │   └── voice/                      # Text-to-speech API
│   ├── auth/                           # Authentication pages
│   ├── bookings/                       # Booking success/cancel pages
│   ├── components/                     # Reusable React components
│   │   ├── ChatBot.tsx                # Main AI chatbot
│   │   ├── BookingAgent.tsx           # Natural language booking
│   │   ├── NavBar.tsx                 # Navigation component
│   │   └── AuthProvider.tsx           # Auth context
│   ├── dashboard/                      # User dashboard
│   ├── page.tsx                        # Landing page
│   └── layout.tsx                      # Root layout
│
├── backend/                            # Python FastAPI backend
│   ├── app/
│   │   ├── agent/                     # LangGraph AI agent
│   │   │   ├── graph.py              # Agent workflow definition
│   │   │   ├── prompts.py            # System prompts
│   │   │   ├── state.py              # Agent state management
│   │   │   └── tools/                # Agent tools
│   │   │       ├── availability.py   # Check space availability
│   │   │       ├── booking.py        # Create bookings
│   │   │       ├── spaces.py         # Get space info
│   │   │       ├── user.py           # User management
│   │   │       └── virtual_tour.py   # Virtual tour links
│   │   ├── api/                      # FastAPI endpoints
│   │   │   ├── chat.py               # Chat endpoints
│   │   │   ├── bookings.py           # Booking CRUD
│   │   │   ├── knowledge_base.py     # RAG system API
│   │   │   └── webhooks.py           # Stripe webhooks
│   │   ├── services/                 # Business logic
│   │   │   ├── knowledge_base.py     # RAG service
│   │   │   ├── notifications.py      # Email service
│   │   │   └── supabase.py           # Database client
│   │   ├── config.py                 # Configuration
│   │   └── main.py                   # FastAPI app
│   └── requirements.txt               # Python dependencies
│
├── supabase/                          # Database migrations
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_add_stripe_customer_and_spaces.sql
│       ├── 003_knowledge_base_rag.sql
│       └── 004_create_knowledge_base_bucket.sql
│
├── lib/                               # Shared utilities
│   └── supabase/                     # Supabase client configs
│
├── package.json                       # Node dependencies
└── README.md                          # This file
```

## 🤖 AI Agent Capabilities

The LangGraph-based AI agent can:
- **Check Availability**: Query real-time space availability
- **Create Bookings**: Process natural language booking requests
- **Handle Payments**: Integrate with Stripe for secure payments
- **Answer Questions**: RAG-powered responses from knowledge base
- **Provide Tours**: Share virtual tour links
- **User Management**: Retrieve and update user information
- **Multi-turn Conversations**: Maintain context across interactions

## 💳 Payment Flow

1. User makes booking request (via agent or form)
2. Agent validates availability and pricing
3. Stripe checkout session created
4. User completes payment
5. Webhook confirms payment
6. Booking confirmed in database
7. Email sent with:
   - Booking details
   - QR code for check-in
   - PDF invoice (optional)
   - Check-in link

## 🔐 Authentication & Security

- **Supabase Auth**: Row-level security (RLS) enabled
- **JWT Tokens**: Secure API authentication
- **Admin Routes**: Protected admin-only pages
- **Stripe Webhooks**: Signature verification
- **Environment Variables**: Secure credential management

## 📊 Database Schema

### Main Tables
- **users**: User accounts and profiles
- **spaces**: Available workspaces
- **bookings**: Booking records
- **payments**: Payment transactions
- **knowledge_base_documents**: RAG document storage
- **knowledge_base_chunks**: Vector embeddings for semantic search
- **unanswered_queries**: Track failed AI responses

## 🚀 Deployment

### Frontend (Vercel)
```bash
npm run build
vercel deploy
```

### Backend (Railway/Render/Heroku)
```bash
# Build
pip install -r requirements.txt

# Run
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Environment Configuration
Update environment variables in production:
- Set `FRONTEND_URL` to your deployed frontend URL
- Configure `STRIPE_WEBHOOK_SECRET` with production webhook
- Update CORS settings in `backend/app/main.py`

## 🧪 Testing

### Frontend
```bash
npm run lint
```

### Backend
```bash
# Run server
uvicorn app.main:app --reload

# Test endpoints
curl http://localhost:8000/health
```

## 📈 Monitoring & Logging

- **Backend Logs**: FastAPI automatic logging
- **Stripe Dashboard**: Payment and webhook monitoring
- **Supabase Dashboard**: Database and auth monitoring
- **OpenAI Usage**: Track API usage and costs

## 🔧 Configuration & Customization

### Modify AI Behavior
- **Prompts**: Edit `backend/app/agent/prompts.py`
- **Tools**: Add/modify tools in `backend/app/agent/tools/`
- **Workflow**: Update graph in `backend/app/agent/graph.py`

### Update Knowledge Base
- Upload documents via admin panel
- Direct API calls to `/api/knowledge-base/upload`
- Automatic chunking and embedding

### Customize UI
- **Colors**: Update Tailwind classes
- **Components**: Modify in `app/components/`
- **Layouts**: Edit page layouts in respective directories

## 📝 API Documentation

### Main Endpoints

**Chat**
- `POST /api/chat` - User chatbot
- `POST /api/admin/chat` - Admin chatbot

**Bookings**
- `GET /api/bookings` - List bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings/{id}` - Get booking details

**Knowledge Base**
- `POST /api/knowledge-base/upload` - Upload document
- `GET /api/knowledge-base/documents` - List documents
- `GET /api/knowledge-base/search` - Semantic search

**Webhooks**
- `POST /api/webhooks/stripe` - Stripe webhook handler

Full API documentation available at `http://localhost:8000/docs` when backend is running.

## 🐛 Troubleshooting

### Common Issues

**Frontend not connecting to backend**
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check CORS configuration in backend

**AI responses failing**
- Verify `OPENAI_API_KEY` is valid
- Check OpenAI API quota and billing

**Payments not working**
- Test Stripe keys (use test mode initially)
- Verify webhook endpoint is accessible
- Check Stripe dashboard for webhook events

**Email not sending**
- Configure Resend API key
- Verify sender email is authorized
- See `backend/EMAIL_SETUP.md` for details

**Knowledge base not working**
- Ensure pgvector extension is enabled
- Check document upload size limits
- Verify OpenAI embeddings quota

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [Supabase Documentation](https://supabase.com/docs)
- [Stripe Documentation](https://stripe.com/docs)

## 🎯 Roadmap

### Completed ✅
- Landing page and booking system
- AI chatbot with RAG
- Admin panel with analytics
- Payment integration
- Email notifications
- Voice support
- Knowledge base management

### Planned 🎯
- Mobile app (React Native)
- Advanced analytics dashboard
- Multi-language support (Bahasa, Chinese)
- Integration with access control systems
- Member community features
- Automated billing and invoicing
- IoT device integration

## 📄 License

MIT License - feel free to use this project for your own purposes.
