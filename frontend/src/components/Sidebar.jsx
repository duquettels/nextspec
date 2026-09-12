export default function Sidebar() {
    return (

        <div className="sidebar">
            <div className="brand">⬡ NEXTSPEC</div>

            <div className="nav-item active">Dashboard</div>
            <div className="nav-item">3D Builder</div>
            <div className="nav-item">Optimizer</div>
            <div className="nav-item">Upgrade Advisor</div>
            <div className="nav-item">Price Checker</div>
            <div style={{ flex: 1 }} />
            <div className="nav-item">⚙ Settings</div>
        </div>
    );
}

