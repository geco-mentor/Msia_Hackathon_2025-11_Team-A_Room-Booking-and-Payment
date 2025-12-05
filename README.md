# Infinity8 - Coworking Space Web App

A modern, responsive web application for Infinity8, Malaysia's premier coworking space company. Built for a hackathon with Next.js, React, and TypeScript.

## 🚀 Features

### Landing Page
- **Hero Section**: Eye-catching gradient design with clear call-to-action
- **Workspace Solutions**: Hot desks, private offices, and meeting rooms
- **Premium Amenities**: Showcase of 8+ premium facilities
- **Pricing Plans**: Three flexible pricing tiers (Day Pass, Monthly, Private Office)
- **Responsive Design**: Fully mobile-friendly with Tailwind CSS
- **Multi-location Support**: Coverage across Kuala Lumpur, Petaling Jaya, and Johor Bahru

### AI Chatbot 🤖
- **Interactive Q&A**: Intelligent chatbot answering questions about:
  - Pricing and membership plans
  - Amenities and facilities
  - Location information
  - Tour booking
  - Operating hours
  - Contact information
  - Workspace types
- **Real-time Chat**: Instant responses with typing indicators
- **Quick Questions**: Pre-defined common questions for easy access
- **Beautiful UI**: Modern chat interface with gradient design
- **Persistent Chat**: Messages are maintained during the session
- **Responsive Chat Window**: Optimized for all screen sizes

## 🛠️ Tech Stack

- **Framework**: Next.js 16.0.7 (with App Router)
- **UI Library**: React 19.2.0
- **Styling**: Tailwind CSS 4
- **Language**: TypeScript 5
- **API Routes**: Next.js API Routes for chatbot backend

## 📦 Installation

1. Clone the repository
```bash
git clone <your-repo-url>
cd geco01
```

2. Install dependencies
```bash
npm install
```

3. Run the development server
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## 📁 Project Structure

```
geco01/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts          # Chatbot API endpoint
│   ├── components/
│   │   └── ChatBot.tsx           # AI Chatbot component
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main landing page
├── public/                       # Static assets
├── package.json
└── README.md
```

## 🎨 Key Components

### ChatBot Component
Located in `app/components/ChatBot.tsx`
- Client-side React component with state management
- Floating chat button with smooth animations
- Message history with timestamps
- Quick question suggestions
- Loading states and error handling

### Chat API Route
Located in `app/api/chat/route.ts`
- Serverless API endpoint
- Knowledge base with Infinity8 information
- Natural language processing for user queries
- Structured responses with formatting

## 💡 Chatbot Capabilities

The AI chatbot can answer questions about:
- ✅ Pricing plans (Day Pass, Monthly, Private Office)
- ✅ Amenities (WiFi, parking, gym, etc.)
- ✅ Locations (KL, PJ, JB)
- ✅ Workspace types (hot desks, private offices, meeting rooms)
- ✅ Tour booking process
- ✅ Operating hours and access
- ✅ Contact information
- ✅ Parking availability
- ✅ Internet speeds

## 🎯 Usage

### Interacting with the Chatbot
1. Click the purple chat button in the bottom-right corner
2. Type your question or click a quick question
3. Receive instant, context-aware responses
4. Continue the conversation naturally

### Example Questions
- "What are your pricing plans?"
- "What amenities do you offer?"
- "Where are your locations?"
- "Can I book a tour?"
- "Do you have parking?"
- "What are your operating hours?"

## 🚀 Deployment

### Build for Production
```bash
npm run build
npm start
```

### Deploy to Vercel
The easiest way to deploy is using [Vercel](https://vercel.com):
```bash
vercel deploy
```

## 🔧 Configuration

### Customizing the Chatbot
Edit `app/api/chat/route.ts` to:
- Add more knowledge base entries
- Modify response templates
- Add new question patterns
- Integrate with external AI APIs (OpenAI, Anthropic, etc.)

### Styling
- Global styles: `app/globals.css`
- Tailwind config: `tailwind.config.js`
- Component styles: Inline Tailwind classes

## 📝 Future Enhancements

- [ ] Integrate with OpenAI/Anthropic for more advanced AI responses
- [ ] Add booking system integration
- [ ] User authentication and member portal
- [ ] Real-time availability checker
- [ ] Virtual tour 360° viewer
- [ ] Payment gateway integration
- [ ] Admin dashboard
- [ ] Multi-language support (Bahasa Malaysia, Chinese)
- [ ] Chat history persistence
- [ ] Email notifications

## 🏆 Hackathon Notes

This project was built for the Infinity8 hackathon with a focus on:
- Clean, modern UI/UX
- Interactive AI chatbot for customer service
- Mobile-first responsive design
- Fast performance with Next.js
- Easy deployment and scalability

## 📄 License

MIT License - feel free to use this project for your own purposes.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 📞 Contact

For questions about Infinity8:
- Email: hello@infinity8.my
- Phone: +60 3-1234-5678

---

Built with ❤️ for Infinity8 Hackathon
