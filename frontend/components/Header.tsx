import React from 'react'
import ProfileAction from './ProfileAction'
import { ModeToggle } from './ModeToggle'

const Header = () => {
  return (
    <div className='flex w-full items-center justify-between p-4'>   
        <h1>NetGen</h1>
        <div className='flex items-center gap-2'>
            <ModeToggle/>
           <ProfileAction/> 
        </div>
        
    </div>
  )
}

export default Header