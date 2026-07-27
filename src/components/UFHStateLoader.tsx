import { UFHLogo } from "@/components/UFHLogo";

interface UFHStateLoaderProps {
  message?: string;
  className?: string;
  overlayClassName?: string;
  logoClassName?: string;
}

export const UFHStateLoader = ({
  message,
  className = "",
  overlayClassName = "",
  logoClassName = "w-12 h-12 md:w-16 md:h-16",
}: UFHStateLoaderProps) => {
  return (
    <div className={`absolute inset-0 z-10 flex items-center justify-center rounded-inherit bg-white/70 backdrop-blur-sm dark:bg-black/30 ${className}`}>
      <div className={`flex flex-col items-center justify-center text-center ${overlayClassName}`}>
        <div className="animate-[pulse_1.2s_ease-in-out_infinite] opacity-70 transition-opacity duration-500">
          <UFHLogo className={logoClassName} />
        </div>
        {message ? <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{message}</p> : null}
      </div>
    </div>
  );
};

export default UFHStateLoader;
