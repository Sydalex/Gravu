import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Footer } from '@/components/Footer';
import { HamburgerMenu } from '@/components/HamburgerMenu';
import { LandingFormats, LandingHero, LandingStory } from '@framer-sync/landing';

const Landing = () => {
  return (
    <div className="relative min-h-screen bg-[#f8f8f6] overflow-hidden flex flex-col">


      {/* Navigation */}
      <header className="relative z-20 flex items-center justify-between px-6 py-6 md:px-12 md:py-8">
        {/* Logo - two dots with text */}
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="flex items-center gap-2"
        >
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-neutral-900" />
            <span className="h-2 w-2 rounded-full bg-neutral-900" />
          </div>
          <span className="font-mono text-sm uppercase tracking-[0.2em] text-neutral-500">Gravu</span>
        </motion.div>

        {/* Nav items */}
        <nav className="flex items-center space-x-6">
          <Link 
            to="/login" 
            className="text-sm uppercase tracking-widest text-foreground/70 hover:text-foreground transition-colors hover:underline underline-offset-4"
          >
            Sign In
          </Link>
          <Link 
            to="/register" 
            className="text-sm uppercase tracking-widest text-foreground/70 hover:text-foreground transition-colors hover:underline underline-offset-4"
          >
            Get Started
          </Link>
          <HamburgerMenu />
        </nav>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col px-6 md:px-12 pt-12 md:pt-20">
        <LandingHero />
        <LandingStory />
        <LandingFormats />
      </main>

      <Footer />
    </div>
  );
};

export default Landing;
