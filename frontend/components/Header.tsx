import React from "react";
import ProfileAction from "./ProfileAction";
import { ModeToggle } from "./ModeToggle";
import Link from "next/link";

const Header = () => {
  return (
    <div className="flex w-full max-w-7xl items-center justify-between p-4">   
        <Link href="/" className="text-2xl font-bold text-gradient-custom">ISPinnacle</Link>
        <div className="flex items-center gap-2">
            <ModeToggle/>
           <ProfileAction/> 
        </div>
        
    </div>
  );
};

export default Header;
