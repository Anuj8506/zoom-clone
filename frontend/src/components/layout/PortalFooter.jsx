import Link from "next/link";

export default function PortalFooter({ onHelp }) {
  return (
    <footer className="portal-footer">
      <div>
        <h3>Zoom Clone</h3>
        <p>Meetings in your browser.</p>
        <p>A video conferencing assignment demo.</p>
      </div>
      <div>
        <h3>Meetings</h3>
        <Link href="/">Home</Link>
        <Link href="/meetings">Upcoming and recent meetings</Link>
      </div>
      <div>
        <h3>My Account</h3>
        <Link href="/settings">Profile and settings</Link>
      </div>
      <div>
        <h3>Support</h3>
        <button onClick={onHelp}>Meeting help</button>
        <span>English</span>
      </div>
      <p className="footer-disclaimer">
        Independent assignment project. Not affiliated with Zoom Communications.
      </p>
    </footer>
  );
}
