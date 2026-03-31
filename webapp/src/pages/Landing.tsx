import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Footer } from '@/components/Footer';
import { HamburgerMenu } from '@/components/HamburgerMenu';

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
        <div className="flex-1 flex gap-12 lg:gap-16">
          {/* Left column - Hero Section */}
          <section className="flex-1 flex flex-col justify-center max-w-2xl">
          {/* Large headline */}
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-[clamp(3rem,12vw,6rem)] font-light leading-[0.95] tracking-tight text-foreground uppercase"
          >
            <span>Photos</span>
            <br />
            become
            <br />
            <span className="text-primary">vectors.</span>
          </motion.h1>

          {/* CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-16 md:mt-20 flex flex-col items-start gap-6"
          >
            {/* Pill button with spinning border */}
            <Link to="/register" className="group relative">
              {/* Spinning decorative border */}
              <span className="absolute -inset-1 rounded-full border border-dashed border-foreground/20 animate-spin-slow" style={{ animationDuration: '12s' }} />
              <span className="relative inline-flex items-center gap-3 rounded-full border-2 border-foreground px-8 py-4 text-sm uppercase tracking-widest text-foreground transition-all hover:bg-foreground hover:text-background">
                Start Creating
              </span>
            </Link>

            {/* Supporting text */}
            <p className="max-w-sm text-sm leading-relaxed text-foreground/60">
              AI-powered vectorization for architects, designers, and creative professionals. Export to SVG, DXF, and PNG.
            </p>
          </motion.div>

          {/* Who we are section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-20 md:mt-32 pb-12"
          >
            <div className="flex items-center gap-4 mb-4">
              <span className="h-px w-12 bg-foreground" />
              <span className="text-sm uppercase tracking-widest text-foreground/70">What We Do</span>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-foreground/60">
              Gravu transforms photographs into precision CAD-ready vectors. Upload any image, let AI detect and extract subjects, then export clean linework for Vectorworks, AutoCAD, SketchUp, and beyond. Two workflows: full photo-to-vector conversion, or direct linework vectorization.
            </p>
          </motion.div>
        </section>

        {/* Right column - Toucan illustration (hidden on mobile, shown on lg) */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 w-[45%] h-full pointer-events-none"
        >
          <svg
            viewBox="-9.5 133.5416259765625 1057 728.4352416992188"
            className="w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g transform="scale(1,-1) translate(0,-995.5184936523438)" stroke="black" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none">
              {/* Toucan body and branch lines - simplified key elements */}
              <polyline points="370,446 371,450.0858154296875 370.5,452" />
              <polyline points="660.5,617.5 662.4771728515625,615.5227966308594 663.537841796875,609.9621276855469 667.0733642578125,601.4266052246094 676.714599609375,581.4201049804688 687.5794677734375,567.4205322265625 694.4163818359375,562.1984252929688 703.4789428710938,557.5210571289062 715.8680419921875,553.6319580078125 724.899169921875,552.5 726.4893798828125,551.5106506347656 739.9849243164062,551.5 741.5707397460938,552.5 744.5499877929688,552.5500183105469 754.8469848632812,555.4544067382812 771.3221435546875,555.5144958496094 773.4390869140625,556.4391174316406 777.4138793945312,556.5 780.9996337890625,557.5 790.9285888671875,562.5 796.8992309570312,567.3992614746094 798.2528076171875,567.7528076171875 808.5,578.0082397460938 808.505859375,579.0058288574219 815.9304809570312,588.9304504394531 819.4660034179688,598.9659729003906 822.5,616.209228515625 822.49072265625,630.2053833007812 820.5,640.380859375 820.5,680.9666748046875 818.5,688.1383056640625 818.5,691.6383056640625 815.57373046875,704.92626953125 815.5,708.395751953125 810.9774169921875,721.5225830078125 806,731.4609985351562 798.249267578125,742.7507629394531 785.5210571289062,756.4789428710938 777,777.4496459960938 768.5,794.4290771484375 763.9437866210938,801.0419616699219 758.2880859375,807.1818542480469 750.4049682617188,813.5 734.1544799804688,821.3455200195312 730,821.5" />
              <polyline points="453,403 453,400 457.5,387.36395263671875 460.5,372.60662841796875 460.5,360.60662841796875 459.51470947265625,358.51470947265625 459.5,353.02081298828125 455.97918701171875,341.97918701171875 453.50433349609375,339.00433349609375 453.5,338.006103515625 449.2474365234375,333.796142578125 442.61273193359375,330.5 437.11273193359375,330.5 435.5,333" />
              <polyline points="664.5,411 663.5,413.0858154296875 663,418.878662109375 663.621337890625,430.621337890625 667.5103759765625,444.5103759765625 676.3492431640625,462.8492431640625 680.5,476.1298828125 682.4473876953125,484.32330322265625 682.5845336914062,490.2664794921875 683.5,492.38726806640625 683.5,512.8872680664062 682.51904296875,514.98095703125 682.5,518.9730529785156 681,525.8517456054688 674.0337524414062,546.4662170410156 674,548.9522094726562 672,553.623779296875 671.9124755859375,556.5875244140625 669.0840454101562,564.4159545898438 669,567.3811645507812 667,571.552734375 666.9627075195312,574.5372924804688 666,575.6384887695312 659.5,606.4461059570312 659.0105590820312,615.234619140625 659.5285034179688,617.0142517089844 660.5,617.5" />
            </g>
          </svg>
        </motion.div>
        </div>

        {/* Bottom section - formats */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="py-12 border-t border-foreground/10"
        >
          <div className="flex flex-wrap items-center gap-8 text-sm uppercase tracking-widest text-foreground/40">
            <span>SVG</span>
            <span className="h-1 w-1 rounded-full bg-foreground/20" />
            <span>DXF</span>
            <span className="h-1 w-1 rounded-full bg-foreground/20" />
            <span>PNG</span>
            <span className="h-1 w-1 rounded-full bg-foreground/20" />
            <span>Vectorworks</span>
            <span className="h-1 w-1 rounded-full bg-foreground/20" />
            <span>AutoCAD</span>
          </div>
        </motion.section>
      </main>

      <Footer />
    </div>
  );
};

export default Landing;
