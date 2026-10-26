import { NavLink } from "react-router-dom";


export default function Sidebar() {

    const getNavClass = ({ isActive }) =>
        `nav-item${isActive ? " active" : ""}`;

    return (

        //ugly chain of navLinks.
        <nav>
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
                Optimizer
            </NavLink>

            <NavLink to="/ai-upgrade-advisor" className={getNavClass}>
                Upgrade Advisor
            </NavLink>

            <NavLink to="/price-checker" className={getNavClass}>
                Price Checker
            </NavLink>
        </nav>




        // <div className="sidebar">

        //     <div className="brand">⬡ NEXTSPEC</div>

        //     <div className="nav-item active">Dashboard</div>
        //     <div className="nav-item">3D Builder</div>
        //     <div className="nav-item">Optimizer</div>
        //     <div className="nav-item">Upgrade Advisor</div>
        //     <div className="nav-item">Price Checker</div>
        //     <div style={{ flex: 1 }} />
        //     <div className="nav-item">⚙ Settings</div>
        // </div>
    );
}

