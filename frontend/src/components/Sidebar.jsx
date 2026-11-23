import { NavLink } from "react-router-dom";


export default function Sidebar() {

    const getNavClass = ({ isActive }) =>
        `nav-item${isActive ? " active" : ""}`;

    return (

        //ugly chain of navLinks.
        <nav className="sidebar">
            <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                    `brand${isActive ? " active" : ""}`
                }
            >
                ⬡ NEXTSPEC
            </NavLink>

            <NavLink to="/dashboard" className={getNavClass}>
                Dashboard
            </NavLink>

            <NavLink to="/3d-builder" className={getNavClass}>
                3D Builder
            </NavLink>

            <NavLink to="/game-optimizer" className={getNavClass}>
                Game Optimizer
            </NavLink>

            <NavLink to="/ai-upgrade-advisor" className={getNavClass}>
                AI Upgrade Advisor
            </NavLink>

            <NavLink to="/price-checker" className={getNavClass}>
                Price Checker
            </NavLink>
        </nav>


    );
}

