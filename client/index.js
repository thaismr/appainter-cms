import React from 'react'
import ReactDOM from 'react-dom'
import App from './src/components/app'

const Root = () => {
  return (
    <App>
     <form method="post" action="/auth/login">
      <input name="email" placeholder="Email" />
      <input name="passwd" placeholder="Password" />
      <input type="submit" value="Login" />
     </form>
    </App>
  )
}

ReactDOM.render(
  <Root />,
  document.querySelector('#root')
)
