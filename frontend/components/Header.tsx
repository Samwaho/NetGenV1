import React from "react";
import ProfileAction from "./ProfileAction";
import { ModeToggle } from "./ModeToggle";

const Header = () => {
  return (
    <div className="flex w-full max-w-7xl items-center justify-between p-4">   
        <h1 className="text-2xl font-bold text-gradient-custom">NetGen</h1>
        <div className="flex items-center gap-2">
            <ModeToggle/>
           <ProfileAction/> 
        </div>
        
    </div>
  );
};

export default Header;
