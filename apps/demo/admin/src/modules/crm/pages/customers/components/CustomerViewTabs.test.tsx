import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import CustomerViewTabs from './CustomerViewTabs'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver

describe('CustomerViewTabs', () => {
  it('maps the public pool tab to the supported pool view', () => {
    const onChange = jest.fn()

    render(<CustomerViewTabs value="mine" onChange={onChange} />)
    fireEvent.click(screen.getByRole('tab', { name: '公海' }))

    expect(onChange).toHaveBeenCalledWith('pool')
  })
})
