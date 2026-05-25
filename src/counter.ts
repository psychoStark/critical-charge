/**
 * Sets up a counter functionality on a button element.
 * This function initializes a click counter that increments each time the button is clicked.
 *
 * @param {HTMLButtonElement} element - The button element to attach the counter to
 */
export function setupCounter(element: HTMLButtonElement) {
  /**
   * Current count value.
   * @type {number}
   */
  let counter = 0
  
  /**
   * Updates the counter display and stores the new count value.
   *
   * @param {number} count - The new count value to set
   */
  const setCounter = (count: number) => {
    counter = count  // Store the new count value
    element.innerHTML = `Count is ${counter}`  // Update the button text
  }
  
  // Add click event listener to increment the counter when button is clicked
  element.addEventListener('click', () => setCounter(counter + 1))
  
  // Initialize the counter with value 0
  setCounter(0)
}
