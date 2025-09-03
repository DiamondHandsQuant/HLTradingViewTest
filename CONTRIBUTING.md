# Contributing to HyperLiquid TradingView Demo

Thank you for your interest in contributing to this project! We welcome contributions from the community and are pleased to have you join us.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Git
- Modern web browser
- Basic knowledge of JavaScript, HTML, CSS
- Familiarity with TradingView Charting Library (helpful but not required)

### Development Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/yourusername/HLTradingViewTest.git
   cd HLTradingViewTest
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Start the development server**:
   ```bash
   npm start
   ```
5. **Open your browser** and navigate to `http://localhost:8080`

## 📋 How to Contribute

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title** describing the issue
- **Detailed description** of the problem
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Browser and OS information**
- **Console error messages** (if any)
- **Screenshots** (if applicable)

### Suggesting Features

We welcome feature suggestions! Please:

- Check existing issues and discussions first
- Provide a clear description of the feature
- Explain the use case and benefits
- Consider implementation complexity
- Be open to discussion and feedback

### Code Contributions

#### Types of Contributions Welcome

- 🐛 **Bug fixes**
- ✨ **New features**
- 📚 **Documentation improvements**
- 🎨 **UI/UX enhancements**
- ⚡ **Performance optimizations**
- 🧪 **Test coverage**
- 🔧 **Code refactoring**

#### Development Workflow

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards

3. **Test your changes** thoroughly:
   - Test in multiple browsers
   - Verify real-time data functionality
   - Check responsive design
   - Ensure no console errors

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add amazing new feature"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request** with:
   - Clear title and description
   - Reference related issues
   - Screenshots for UI changes
   - Testing instructions

## 🎯 Coding Standards

### JavaScript Style Guide

- Use **ES6+** features where appropriate
- Follow **camelCase** naming convention
- Use **const** and **let** instead of **var**
- Add **JSDoc comments** for functions and classes
- Keep functions **small and focused**
- Use **meaningful variable names**

#### Example:

```javascript
/**
 * Formats price data for display
 * @param {number} price - Raw price value
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted price string
 */
function formatPrice(price, decimals = 2) {
    return price.toFixed(decimals);
}
```

### HTML/CSS Guidelines

- Use **semantic HTML** elements
- Follow **BEM methodology** for CSS classes
- Ensure **responsive design** compatibility
- Maintain **accessibility** standards
- Use **CSS custom properties** for theming

#### Example:

```css
/* BEM naming convention */
.chart-container {
    position: relative;
}

.chart-container__header {
    display: flex;
    justify-content: space-between;
}

.chart-container__title--active {
    color: var(--primary-color);
}
```

### File Organization

- Keep files **focused and cohesive**
- Use **descriptive file names**
- Group related functionality
- Maintain **consistent structure**

## 🧪 Testing Guidelines

### Manual Testing Checklist

Before submitting a PR, ensure:

- [ ] Application loads without errors
- [ ] Real-time data updates work
- [ ] Chart interactions function properly
- [ ] UI is responsive on different screen sizes
- [ ] No console errors or warnings
- [ ] WebSocket connections handle reconnection
- [ ] Symbol switching works correctly
- [ ] Drawing tools function as expected

### Browser Testing

Test your changes in:

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

### Performance Testing

- Check for memory leaks
- Verify smooth chart rendering
- Test with multiple symbols
- Monitor network requests

## 📖 Documentation

### Code Documentation

- Add **JSDoc comments** for all public functions
- Include **inline comments** for complex logic
- Update **README.md** for new features
- Document **API changes**

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

#### Examples:
```
feat(api): add support for new HyperLiquid endpoints
fix(chart): resolve WebSocket reconnection issue
docs(readme): update installation instructions
style(css): improve responsive design for mobile
```

## 🤝 Community Guidelines

### Code of Conduct

- Be **respectful** and **inclusive**
- Provide **constructive feedback**
- Help others **learn and grow**
- Focus on **collaboration**
- Respect different **perspectives and experiences**

### Communication

- Use **clear and concise** language
- Be **patient** with newcomers
- **Ask questions** when unsure
- **Share knowledge** and resources
- **Celebrate** contributions and achievements

## 🔍 Review Process

### Pull Request Reviews

All contributions go through a review process:

1. **Automated checks** (if configured)
2. **Code review** by maintainers
3. **Testing** and validation
4. **Discussion** and feedback
5. **Approval** and merge

### Review Criteria

- Code quality and style
- Functionality and correctness
- Performance impact
- Documentation completeness
- Test coverage
- Backward compatibility

## 🎉 Recognition

Contributors will be:

- **Listed** in the project contributors
- **Credited** in release notes
- **Thanked** in the community
- **Invited** to join the maintainer team (for significant contributions)

## 📞 Getting Help

If you need help or have questions:

1. **Check the documentation** first
2. **Search existing issues** and discussions
3. **Ask in GitHub Discussions**
4. **Create a new issue** with the "question" label
5. **Join community channels** (if available)

## 🚀 Next Steps

Ready to contribute? Here's what to do:

1. **Browse open issues** labeled "good first issue"
2. **Join the discussion** on features you're interested in
3. **Fork the repository** and start coding
4. **Ask questions** if you need help
5. **Submit your first PR**!

---

Thank you for contributing to the HyperLiquid TradingView Demo! Your contributions help make this project better for everyone. 🙏

**Happy coding!** 🚀
