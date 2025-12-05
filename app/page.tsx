import Image from "next/image";
import ChatBot from "./components/ChatBot";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white border-b border-gray-200 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="text-2xl font-bold text-blue-600">∞8</div>
              <span className="text-xl font-semibold text-gray-900">Infinity8</span>
            </div>
            <div className="hidden md:flex space-x-8">
              <a href="#spaces" className="text-gray-600 hover:text-blue-600 transition">Spaces</a>
              <a href="#amenities" className="text-gray-600 hover:text-blue-600 transition">Amenities</a>
              <a href="#pricing" className="text-gray-600 hover:text-blue-600 transition">Pricing</a>
              <a href="#contact" className="text-gray-600 hover:text-blue-600 transition">Contact</a>
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition">
              Book Tour
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-gray-900 mb-6">
            Where Innovation
            <span className="text-blue-600"> Meets Community</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Experience Malaysia's premier coworking space designed for entrepreneurs, startups, and established businesses seeking flexibility and growth.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition">
              Get Started
            </button>
            <button className="bg-white hover:bg-gray-50 text-gray-900 px-8 py-4 rounded-lg text-lg font-semibold transition border border-gray-300">
              Watch Video
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="spaces" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-gray-900 text-center mb-12">Our Workspace Solutions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Hot Desks",
                description: "Flexible workspace with no fixed seating. Perfect for freelancers and remote workers."
              },
              {
                title: "Private Offices",
                description: "Dedicated offices for teams of all sizes with 24/7 access and customization options."
              },
              {
                title: "Meeting Rooms",
                description: "Professional meeting spaces equipped with AV technology and high-speed internet."
              }
            ].map((feature, idx) => (
              <div key={idx} className="bg-white rounded-lg p-8 border border-gray-200 hover:border-blue-600 transition shadow-sm">
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Amenities Section */}
      <section id="amenities" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-gray-900 text-center mb-12">Premium Amenities</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: "Free Coffee & Tea" },
              { label: "High-Speed WiFi" },
              { label: "Free Parking" },
              { label: "Gym Access" },
              { label: "Gaming Lounge" },
              { label: "Kitchen Facilities" },
              { label: "Phone Booths" },
              { label: "Event Spaces" }
            ].map((amenity, idx) => (
              <div key={idx} className="bg-gray-50 rounded-lg p-6 border border-gray-200 text-center hover:border-blue-600 transition">
                <p className="text-gray-900 font-medium">{amenity.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-gray-900 text-center mb-12">Flexible Pricing Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "Day Pass",
                price: "RM 50",
                period: "per day",
                features: ["Hot desk access", "WiFi", "Coffee & tea", "Printing credits"]
              },
              {
                name: "Monthly",
                price: "RM 800",
                period: "per month",
                features: ["Dedicated desk", "24/7 access", "Meeting room hours", "All amenities", "Mail handling"],
                popular: true
              },
              {
                name: "Private Office",
                price: "RM 2,500",
                period: "per month",
                features: ["Private office space", "24/7 access", "Unlimited meeting rooms", "Priority support", "Custom branding"]
              }
            ].map((plan, idx) => (
              <div key={idx} className={`rounded-lg p-8 border ${plan.popular ? 'bg-blue-50 border-blue-600 shadow-lg' : 'bg-white border-gray-200'}`}>
                {plan.popular && (
                  <span className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm font-semibold">Most Popular</span>
                )}
                <h3 className="text-2xl font-bold text-gray-900 mt-4 mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-600">/{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, fidx) => (
                    <li key={fidx} className="text-gray-600 flex items-center">
                      <span className="mr-2 text-blue-600">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <button className={`w-full py-3 rounded-lg font-semibold transition ${plan.popular ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-300'}`}>
                  Choose Plan
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">Ready to Join Infinity8?</h2>
          <p className="text-xl text-gray-600 mb-8">
            Schedule a tour today and experience our space firsthand. Our team is ready to help you find the perfect workspace solution.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <input
              type="email"
              placeholder="Enter your email"
              className="px-6 py-4 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-semibold transition">
              Schedule Tour
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-gray-200 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="text-2xl font-bold text-blue-600">∞8</div>
                <span className="text-xl font-semibold text-gray-900">Infinity8</span>
              </div>
              <p className="text-gray-600">Malaysia's premier coworking space</p>
            </div>
            <div>
              <h4 className="text-gray-900 font-semibold mb-4">Locations</h4>
              <ul className="space-y-2 text-gray-600">
                <li>Kuala Lumpur</li>
                <li>Petaling Jaya</li>
                <li>Johor Bahru</li>
              </ul>
            </div>
            <div>
              <h4 className="text-gray-900 font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-600">
                <li><a href="#" className="hover:text-blue-600 transition">About Us</a></li>
                <li><a href="#" className="hover:text-blue-600 transition">Careers</a></li>
                <li><a href="#" className="hover:text-blue-600 transition">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-gray-900 font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-gray-600">
                <li>hello@infinity8.my</li>
                <li>+60 3-1234-5678</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8 text-center text-gray-600">
            <p>&copy; 2025 Infinity8. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* AI Chatbot */}
      <ChatBot />
    </div>
  );
}
