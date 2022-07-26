import { useState } from "react";
import Navbar from "./elements/navbar";
import Footer from "./elements/footer";
import NotificationBanner from "./elements/notification-banner";

const Layout = ({ children, global, pageContext }) => {
  const { navbar, footer, notificationBanner } = global;

  const [bannerIsShown, setBannerIsShown] = useState(true);
  return (
    <div className="flex flex-col justify-between min-h-screen text-gray-600 bg-white font-body">
      {/* Aligned to the top */}
      <div className="flex flex-col flex-1">
        {notificationBanner && bannerIsShown && (
          <NotificationBanner
            data={notificationBanner}
            closeSelf={() => setBannerIsShown(false)}
          />
        )}
        <Navbar navbar={navbar} pageContext={pageContext} />
        <div className="flex flex-col flex-grow">{children}</div>
      </div>
      {/* Aligned to the bottom */}
      <Footer footer={footer} />
    </div>
  );
};

export default Layout;
