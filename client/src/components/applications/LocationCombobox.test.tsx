import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { LocationCombobox } from './LocationCombobox'

// The combobox is controlled — this harness owns the value so that typing
// actually filters the list, while still letting us spy on onChange.
function Harness({ initial = '', onChangeSpy }: { initial?: string; onChangeSpy?: (v: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <LocationCombobox
      value={value}
      onChange={v => {
        onChangeSpy?.(v)
        setValue(v)
      }}
    />
  )
}

describe('LocationCombobox', () => {
  it('renders the input with the given value and default placeholder', () => {
    render(<LocationCombobox value="Auckland, NZ" onChange={jest.fn()} />)
    const input = screen.getByRole('combobox')
    expect(input).toHaveValue('Auckland, NZ')
    expect(screen.getByPlaceholderText('Search a location…')).toBe(input)
  })

  it('opens the suggestion list on focus', () => {
    render(<Harness />)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    fireEvent.focus(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getByText('Auckland, NZ')).toBeInTheDocument()
  })

  it('filters suggestions as the user types', () => {
    render(<Harness />)
    fireEvent.focus(screen.getByRole('combobox'))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'well' } })
    expect(screen.getByText('Wellington, NZ')).toBeInTheDocument()
    expect(screen.queryByText('Auckland, NZ')).not.toBeInTheDocument()
  })

  it('calls onChange with the selected option when clicked', () => {
    const onChangeSpy = jest.fn()
    render(<Harness onChangeSpy={onChangeSpy} />)
    fireEvent.focus(screen.getByRole('combobox'))
    // onMouseDown is the selection handler (preventDefault keeps focus)
    fireEvent.mouseDown(screen.getByText('Wellington, NZ'))
    expect(onChangeSpy).toHaveBeenCalledWith('Wellington, NZ')
    expect(screen.getByRole('combobox')).toHaveValue('Wellington, NZ')
  })

  it('allows arbitrary free-text not in the suggestion list', () => {
    const onChangeSpy = jest.fn()
    render(<Harness onChangeSpy={onChangeSpy} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Stewart Island, NZ' } })
    expect(onChangeSpy).toHaveBeenCalledWith('Stewart Island, NZ')
    expect(screen.getByRole('combobox')).toHaveValue('Stewart Island, NZ')
  })

  it('selects the highlighted option with the keyboard', () => {
    const onChangeSpy = jest.fn()
    render(<Harness onChangeSpy={onChangeSpy} />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'wellington' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChangeSpy).toHaveBeenCalledWith('Wellington, NZ')
  })

  it('closes the list on Escape', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('closes the list when clicking outside', () => {
    render(<Harness />)
    fireEvent.focus(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
