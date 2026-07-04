import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { Button } from './Button'

function ClickCounter() {
  const [clicks, setClicks] = useState(0)

  return <Button onClick={() => setClicks((count) => count + 1)}>Clicks: {clicks}</Button>
}

describe('Button', () => {
  it('responds to a player interaction', async () => {
    const user = userEvent.setup()
    render(<ClickCounter />)

    await user.click(screen.getByRole('button', { name: 'Clicks: 0' }))

    expect(screen.getByRole('button', { name: 'Clicks: 1' })).toBeInTheDocument()
  })
})
