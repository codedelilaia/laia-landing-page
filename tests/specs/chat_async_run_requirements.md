# Async chat run requirements

- Sending a message shows the user bubble immediately.
- An assistant placeholder appears right away without waiting for Hermes completion.
- Refresh during a running run restores the pending state.
- Failed runs render inline friendly errors inside chat.
- No raw JSON, `[Object object]`, or page-level timeout errors should be shown to the user.
