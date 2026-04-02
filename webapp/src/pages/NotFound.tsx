import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#f8f8f6] overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 text-center px-4"
      >
        {/* Large 404 */}
        <h1 className="text-[120px] md:text-[180px] font-extralight tracking-tight text-neutral-200 leading-none">
          404
        </h1>
        
        {/* Message */}
        <div className="mt-[-20px] md:mt-[-40px]">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400 mb-4">
            Page not found
          </p>
          <p className="font-mono text-xs text-neutral-500 max-w-[300px] mx-auto leading-relaxed">
            {"The page you're looking for doesn't exist or has been moved."}
          </p>
        </div>

        {/* Back link */}
        <Link
          to="/welcome"
          className="group inline-flex items-center gap-2 mt-8"
        >
          <span className="relative inline-flex items-center gap-3 rounded-full border-2 border-neutral-900 px-6 py-3 font-mono text-xs uppercase tracking-widest text-neutral-900 transition-all group-hover:bg-neutral-900 group-hover:text-white">
            <ArrowLeft className="h-3 w-3" />
            Return home
          </span>
        </Link>

        {/* Decorative line */}
        <div className="mt-12 mx-auto w-16 h-px bg-neutral-200" />
      </motion.div>
    </div>
  );
};

export default NotFound;
