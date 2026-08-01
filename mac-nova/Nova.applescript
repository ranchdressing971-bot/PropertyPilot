-- RideBy Nova — Mac launcher
-- Opens the Nova console in an app-style browser window.
on run
	set novaURL to "https://rideby.live/nova"
	
	-- Prefer Chrome app window (no browser chrome)
	try
		do shell script "open -na 'Google Chrome' --args --app=" & quoted form of novaURL
		return
	end try
	
	try
		do shell script "open -na 'Chromium' --args --app=" & quoted form of novaURL
		return
	end try
	
	try
		do shell script "open -na 'Microsoft Edge' --args --app=" & quoted form of novaURL
		return
	end try
	
	-- Safari fallback
	tell application "Safari"
		activate
		open location novaURL
	end tell
end run
