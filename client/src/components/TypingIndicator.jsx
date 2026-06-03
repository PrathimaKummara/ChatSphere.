// TypingIndicator component shows a WhatsApp-style "User is typing..." bubble
const TypingIndicator = ({ typingUsers, currentUsername }) => {
  // Convert the typingUsers object into an array of names and filter out the current user (Fix: typingUsers is an object)
  const othersTyping = Object.keys(typingUsers || {}).filter(name => name !== currentUsername);

  // If no one else is typing, render nothing
  if (othersTyping.length === 0) {
    return null;
  }

  // Format the text based on how many people are typing
  let senderName = '';
  if (othersTyping.length === 1) {
    senderName = othersTyping[0];
  } else if (othersTyping.length === 2) {
    senderName = `${othersTyping[0]} and ${othersTyping[1]}`;
  } else {
    senderName = 'Several people';
  }

  return (
    <div className="flex w-full mb-[2px] justify-start">
      <div className="relative max-w-[65%] flex flex-col items-start">
        
        {/* The actual colored bubble matching received messages */}
        <div 
          className="relative px-[12px] py-[8px] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] bg-white dark:bg-[#1f2c34] rounded-[18px_18px_18px_4px] ml-[8px] min-w-[70px]"
        >
          {/* CSS Tail using absolute positioning for Received Message */}
          <div className="absolute left-[-8px] bottom-0 w-0 h-0 border-b-[16px] border-b-white dark:border-b-[#1f2c34] border-l-[12px] border-l-transparent"></div>

          {/* Show the sender's name above the dots */}
          <span className="text-[13px] font-[600] text-[#7F77DD] mb-[4px] block">
            {senderName}
          </span>
          
          {/* 3 Bouncing Dots */}
          <div className="flex items-center space-x-[4px] h-[16px] px-[4px] py-[2px]">
            <div className="w-[6px] h-[6px] bg-[#667781] dark:bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-[6px] h-[6px] bg-[#667781] dark:bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-[6px] h-[6px] bg-[#667781] dark:bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Export the component for use in ChatWindow
export default TypingIndicator;
