import { NavLink } from "react-router-dom";


export default function Sidebar() {
    return (

        //ugly chain of navLinks.
        <nav>
            <NavLink 
                to="/Dashboard" className="brand" activeClassName="active">⬡ NEXTSPEC
                </NavLink>

            <NavLink 
                to="/Dashboard" className="nav-item" activeClassName="active">Dashboard
            </NavLink >

            <NavLink
                to="/threeDBuilder" className="nav-item" activeClassName="active">3DBuilder
            </NavLink>

            <NavLink
                to="/GameOptimizer" className="nav-item" activeClassName="active">Optimizer
            </NavLink>

            <NavLink
                to="/AIUpgradeAdvisor" className="nav-item" activeClassName="active">Upgrade Advisor
            </NavLink>

            <NavLink
                to="/PriceChecker" className="nav-item" activeClassName="active">Price Checker
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

