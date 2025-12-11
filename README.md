# Infinity8 - Smart Coworking Space Platform

A comprehensive, AI-powered coworking space management platform for Infinity8, Malaysia's premier coworking space company. Built with Next.js, FastAPI, and powered by advanced AI agents including an intelligent WhatsApp booking bot.

## 🎯 Overview

Infinity8 is a full-stack platform that combines beautiful user-facing features with powerful admin tools, all enhanced by AI capabilities including natural language booking, intelligent chatbots, WhatsApp automation, and RAG-powered knowledge management.

## 📁 Project Structure

This is a monorepo containing frontend, backend, and WhatsApp bot applications:

```
geco01/
├── frontend/          # Next.js frontend application
│   ├── app/          # Next.js app directory
│   ├── lib/          # Shared utilities
│   ├── public/       # Static assets
│   └── ...
├── backend/          # FastAPI backend application
│   ├── app/          # FastAPI application
│   └── ...
├── whatsapp-bot/     # WhatsApp booking bot
│   ├── index.js      # Main bot server
│   ├── prompts.js    # AI conversation prompts
│   ├── invoices/     # Generated PDF invoices
│   └── README.md     # WhatsApp bot documentation
└── README.md         # This file
```

### Getting Started

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

#### Backend Setup
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

#### WhatsApp Bot Setup
```bash
cd whatsapp-bot
npm install
npm start
```

See individual README files in `frontend/`, `backend/`, and `whatsapp-bot/` directories for detailed setup instructions.

## ✨ Key Features

### 🌐 User-Facing Features

#### Landing Page & Booking
- **Modern Design**: Responsive landing page with hero section, workspace solutions, amenities, and pricing
- **AI Booking Agent**: Natural language booking system - just describe what you need
- **Voice Support**: Speech-to-text booking with ElevenLabs integration
- **Payment Integration**: Secure Stripe checkout with automatic email confirmations
- **Multi-location Support**: Kuala Lumpur, Petaling Jaya, and Johor Bahru

#### WhatsApp Booking Bot 📱
- **24/7 Automated Bookings**: Book meeting rooms via WhatsApp anytime
- **Natural Language AI**: GPT-4 powered conversations for seamless booking
- **Smart Date Parsing**: Understands "tomorrow", "next Friday", relative dates
- **Real-time Availability**: Automatic conflict detection and prevention
- **Payment Processing**: Secure Stripe checkout with 30-minute booking hold
- **Add-ons System**: Projectors, LCD screens, extra chairs with per-hour pricing
- **Automated Invoicing**: PDF invoices generated and sent via WhatsApp
- **Cancellation Management**: 24-hour policy with automated refunds
- **Multi-booking Support**: Manage multiple bookings per user
- **Payment Reminders**: 10-minute warnings before booking expiration

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

### WhatsApp Bot Stack
- **Runtime**: Node.js + Express
- **AI**: OpenAI GPT-4 (gpt-4o-mini)
- **Messaging**: Twilio WhatsApp Business API
- **Database**: MongoDB Atlas
- **Payments**: Stripe Checkout & Webhooks
- **PDF Generation**: PDFKit
- **Development**: ngrok for local webhook testing

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
- Twilio account (for WhatsApp bot)
- MongoDB Atlas account (for WhatsApp bot)

### Frontend Setup

1. **Clone and install dependencies**
```bash
git clone <repository-url>
cd geco01/frontend
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

### WhatsApp Bot Setup

1. **Navigate to WhatsApp bot directory**
```bash
cd whatsapp-bot
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
Create `.env` in the `whatsapp-bot/` directory:
```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx

# Stripe Configuration
STRIPE_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx

# MongoDB Configuration
MONGO_DB=mongodb+srv://username:password@cluster.mongodb.net/infinity8?retryWrites=true&w=majority

# Server Configuration
PORT=3000
BASE_URL=http://localhost:3000
```

4. **Set up ngrok for local development**
```bash
# In a separate terminal
ngrok http 3000
```

5. **Configure Twilio webhook**
- Copy ngrok HTTPS URL (e.g., `https://abc-123.ngrok-free.app`)
- Go to [Twilio Console](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn)
- Set webhook: `https://abc-123.ngrok-free.app/whatsapp`
- Method: POST

6. **Configure Stripe webhook**
- Go to [Stripe Dashboard](https://dashboard.stripe.com/test/webhooks)
- Add endpoint: `https://abc-123.ngrok-free.app/stripe-webhook`
- Select events: `checkout.session.completed`, `checkout.session.expired`

7. **Run the WhatsApp bot**
```bash
npm start
```

Bot will be available at [http://localhost:3000](http://localhost:3000)

See `whatsapp-bot/README.md` for detailed WhatsApp bot documentation.

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

4. **Create MongoDB database (for WhatsApp bot)**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create a new cluster
   - Create database named `infinity8`
   - Add collections: `rooms`, `bookings`
   - Configure network access (allow 0.0.0.0/0 for development)

## 📁 Detailed Project Structure

```
geco01/
├── frontend/                           # Next.js frontend
│   ├── app/                            # Next.js app directory
│   │   ├── admin/                      # Admin panel
│   │   │   ├── dashboard/              # Admin dashboard with AI assistant
│   │   │   ├── bookings/               # Booking management
│   │   │   ├── spaces/                 # Space analytics & management
│   │   │   └── knowledge-base/         # RAG knowledge base management
│   │   ├── api/                        # Next.js API routes
│   │   │   ├── chat/                   # User chatbot API
│   │   │   ├── admin/chat/             # Admin chatbot API
│   │   │   ├── speech-to-text/         # Voice input processing
│   │   │   └── voice/                  # Text-to-speech API
│   │   ├── auth/                       # Authentication pages
│   │   ├── bookings/                   # Booking success/cancel pages
│   │   ├── components/                 # Reusable React components
│   │   │   ├── ChatBot.tsx            # Main AI chatbot
│   │   │   ├── BookingAgent.tsx       # Natural language booking
│   │   │   ├── NavBar.tsx             # Navigation component
│   │   │   └── AuthProvider.tsx       # Auth context
│   │   ├── dashboard/                  # User dashboard
│   │   ├── page.tsx                    # Landing page
│   │   └── layout.tsx                  # Root layout
│   ├── lib/                            # Shared utilities
│   │   └── supabase/                   # Supabase client configs
│   ├── public/                         # Static assets
│   ├── package.json                    # Node dependencies
│   └── README.md                       # Frontend documentation
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
│   ├── requirements.txt               # Python dependencies
│   └── README.md                      # Backend documentation
│
├── whatsapp-bot/                      # WhatsApp booking bot
│   ├── index.js                       # Main bot server & Express app
│   ├── prompts.js                     # GPT-4 conversation prompts
│   ├── invoiceGenerator.js            # PDF invoice generation
│   ├── paymentPages.js                # Payment success/cancel HTML
│   ├── invoices/                      # Generated PDF invoices
│   ├── package.json                   # Node dependencies
│   ├── .env.example                   # Environment template
│   └── README.md                      # WhatsApp bot documentation
│
├── supabase/                          # Database migrations
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_add_stripe_customer_and_spaces.sql
│       ├── 003_knowledge_base_rag.sql
│       └── 004_create_knowledge_base_bucket.sql
│
└── README.md                          # This file
```

## 🤖 AI Agent Capabilities

### Web/App AI Agent (LangGraph)
- **Check Availability**: Query real-time space availability
- **Create Bookings**: Process natural language booking requests
- **Handle Payments**: Integrate with Stripe for secure payments
- **Answer Questions**: RAG-powered responses from knowledge base
- **Provide Tours**: Share virtual tour links
- **User Management**: Retrieve and update user information
- **Multi-turn Conversations**: Maintain context across interactions

### WhatsApp Bot AI Features
- **Natural Language Understanding**: Interprets casual booking requests
- **Smart Date Parsing**: Converts "tomorrow", "next week" to actual dates
- **Add-on Recognition**: Understands equipment requests in natural language
- **Conflict Detection**: Prevents double bookings automatically
- **Payment Flow Management**: Guides users through secure checkout
- **Cancellation Handling**: Manages refunds based on 24-hour policy
- **Multi-booking Support**: Handles multiple bookings per conversation
- **Reminder System**: Sends payment expiration warnings

## 💳 Payment Flow

### Web/App Payment Flow
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

### WhatsApp Bot Payment Flow
1. User books via WhatsApp conversation
2. Bot validates availability and calculates pricing
3. Stripe checkout link sent to WhatsApp
4. User pays within 30 minutes
5. Webhook confirms payment
6. Bot sends confirmation message
7. PDF invoice sent via WhatsApp
8. Booking saved to MongoDB

## 🔐 Authentication & Security

- **Supabase Auth**: Row-level security (RLS) enabled
- **JWT Tokens**: Secure API authentication
- **Admin Routes**: Protected admin-only pages
- **Stripe Webhooks**: Signature verification
- **Environment Variables**: Secure credential management
- **Twilio Webhooks**: Request validation for WhatsApp messages
- **MongoDB Security**: Username/password authentication with network restrictions

## 📊 Database Schema

### Supabase (PostgreSQL)
- **users**: User accounts and profiles
- **spaces**: Available workspaces
- **bookings**: Booking records
- **payments**: Payment transactions
- **knowledge_base_documents**: RAG document storage
- **knowledge_base_chunks**: Vector embeddings for semantic search
- **unanswered_queries**: Track failed AI responses

### MongoDB (WhatsApp Bot)
- **rooms**: Meeting room information (name, price, seats, projector)
- **bookings**: WhatsApp booking records with payment and refund tracking

Example booking document:
```javascript
{
  whatsappNumber: String,       // User's WhatsApp number
  userName: String,             // User's profile name
  roomName: String,             // "A", "B", "C"
  date: String,                 // "2025-12-15"
  time: String,                 // "14:00-16:00"
  status: String,               // "pending", "completed", "cancelled", "refunded"
  adds: [String],               // ["projector x2", "chairs x5"]
  paymentSessionId: String,     // Stripe session ID
  paymentIntentId: String,      // Stripe payment intent ID
  invoiceNumber: String,        // "INV-202512-00001"
  amountPaid: Number,           // Total amount in MYR
  refundAmount: Number,         // Refund amount if applicable
  refundId: String,             // Stripe refund ID
  expiresAt: Date,              // Booking expiration (for pending)
  createdAt: Date               // Booking creation time
}
```

## 🚀 Deployment

### Frontend (Vercel)
```bash
cd frontend
npm run build
vercel deploy
```

### Backend (Railway/Render/Heroku)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### WhatsApp Bot (Railway/Render)

**Railway Deployment:**
1. Create Railway account at [railway.app](https://railway.app)
2. Create new project from GitHub repo
3. Add environment variables in Railway dashboard
4. Deploy - Railway auto-deploys from main branch
5. Update Twilio webhook with Railway URL
6. Update Stripe webhook with Railway URL

**Render Deployment:**
1. Create Render account at [render.com](https://render.com)
2. New Web Service from GitHub
3. Configure:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Add environment variables
5. Deploy
6. Update webhooks with Render URL

**Production Checklist:**
- ✅ Use production Stripe keys
- ✅ Upgrade Twilio from sandbox to WhatsApp Business
- ✅ Set up proper domain (not ngrok)
- ✅ Enable MongoDB Atlas IP whitelist for production
- ✅ Configure automatic backups for MongoDB
- ✅ Set up error monitoring (Sentry, LogRocket)

### Environment Configuration
Update environment variables in production:
- Set `FRONTEND_URL` to your deployed frontend URL
- Set `BASE_URL` to your deployed WhatsApp bot URL
- Configure `STRIPE_WEBHOOK_SECRET` with production webhook
- Update CORS settings in `backend/app/main.py`

## 🧪 Testing

### Frontend
```bash
cd frontend
npm run lint
```

### Backend
```bash
cd backend
uvicorn app.main:app --reload
curl http://localhost:8000/health
```

### WhatsApp Bot
```bash
cd whatsapp-bot
npm start

# Test endpoints
curl http://localhost:3000/health

# Test WhatsApp webhook (after ngrok setup)
# Send a WhatsApp message to your Twilio number
```

## 📈 Monitoring & Logging

- **Backend Logs**: FastAPI automatic logging
- **WhatsApp Bot Logs**: Console logs for message flow and errors
- **Stripe Dashboard**: Payment and webhook monitoring
- **Supabase Dashboard**: Database and auth monitoring
- **MongoDB Atlas**: Database monitoring and alerts
- **Twilio Console**: WhatsApp message logs and webhook events
- **OpenAI Usage**: Track API usage and costs
- **ngrok Inspector**: Local webhook debugging at http://127.0.0.1:4040

## 🔧 Configuration & Customization

### Modify AI Behavior

**Web/App Agent:**
- **Prompts**: Edit `backend/app/agent/prompts.py`
- **Tools**: Add/modify tools in `backend/app/agent/tools/`
- **Workflow**: Update graph in `backend/app/agent/graph.py`

**WhatsApp Bot:**
- **Prompts**: Edit `whatsapp-bot/prompts.js`
- **Pricing**: Modify `ADDON_PRICES` in `whatsapp-bot/index.js`
- **Policies**: Update timeout and cancellation hours
- **Invoice Design**: Customize in `whatsapp-bot/invoiceGenerator.js`

### Update Knowledge Base
- Upload documents via admin panel
- Direct API calls to `/api/knowledge-base/upload`
- Automatic chunking and embedding

### Customize UI
- **Colors**: Update Tailwind classes (currently using `#b48c5c` gold theme)
- **Components**: Modify in `frontend/app/components/`
- **Layouts**: Edit page layouts in respective directories
- **Logo**: Replace `/logo.png` in `frontend/public/`

## 📝 API Documentation

### Main Web/App Endpoints

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

### WhatsApp Bot Endpoints

**WhatsApp Webhook**
- `POST /whatsapp` - Receives incoming WhatsApp messages from Twilio

**Stripe Webhook**
- `POST /stripe-webhook` - Handles payment confirmations and expirations

**Booking Endpoints**
- `GET /my-bookings/:whatsappNumber` - Get user bookings
- `POST /cancel-booking` - Cancel a booking
- `GET /bookings` - Admin: View all bookings

**Health & Status**
- `GET /health` - Returns server status and MongoDB connection state

**Payment Pages**
- `GET /payment-success` - Payment confirmation page
- `GET /payment-cancel` - Payment cancellation page

Full API documentation:
- **Backend**: Available at `http://localhost:8000/docs` when backend is running
- **WhatsApp Bot**: See `whatsapp-bot/README.md` for detailed endpoint documentation

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

**WhatsApp bot not responding**
- Check server is running (`npm start`)
- Verify ngrok is running and URL is current
- Confirm Twilio webhook is configured properly
- Check MongoDB connection (view console logs)
- Verify all environment variables are set

**WhatsApp payment not processing**
- Check Stripe webhook secret is correct
- Ensure webhook URL in Stripe dashboard matches ngrok URL
- Verify Stripe test mode is enabled
- Review Stripe logs for errors

**WhatsApp PDF not sending**
- Ensure invoice directory exists and is writable
- Verify BASE_URL is set correctly in `.env`
- Check if PDF file was generated in `/invoices` folder
- Confirm Twilio message limit not exceeded (50/day on sandbox)

**MongoDB connection failed**
- Check connection string format matches: `mongodb+srv://user:pass@cluster.mongodb.net/infinity8`
- Verify username/password (URL-encode special characters)
- Add current IP to MongoDB Atlas whitelist (0.0.0.0/0 for testing)
- Ensure database name `/infinity8` is included in URI

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [Supabase Documentation](https://supabase.com/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp)
- [MongoDB Atlas Documentation](https://www.mongodb.com/docs/atlas/)
- [OpenAI API Documentation](https://platform.openai.com/docs)

## 🎯 Roadmap

### Completed ✅
- Landing page and booking system
- AI chatbot with RAG
- Admin panel with analytics
- Payment integration
- Email notifications
- Voice support
- Knowledge base management
- **WhatsApp booking bot with AI conversations**
- **Automated invoice generation via WhatsApp**
- **24-hour cancellation policy with refunds**
- **Add-ons system (projectors, screens, chairs)**

### In Progress 🚧
- Mobile app (React Native)
- Advanced analytics dashboard
- Multi-language support (Bahasa, Chinese)

### Planned 🎯
- Integration with access control systems
- Member community features
- Automated billing and invoicing
- IoT device integration
- WhatsApp group booking features
- WhatsApp bot multi-language support
- Voice message support for WhatsApp bot
- Recurring bookings via WhatsApp

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

MIT License - feel free to use this project for your own purposes.
