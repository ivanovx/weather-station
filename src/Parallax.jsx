import React from 'react'
import PropTypes from 'prop-types'
import Animated from 'animated/lib/targets/react-dom'

export class Layer extends React.Component {
    static contextTypes = { parallax: PropTypes.object }
    static propTypes = {
        factor: PropTypes.number,
        offset: PropTypes.number,
        speed: PropTypes.number,
    }
    static defaultProps = {
        factor: 1,
        offset: 0,
        speed: 0,
    }

    constructor(props, context) {
        super(props, context)
        const parallax = this.context.parallax
        const targetScroll = Math.floor(props.offset) * parallax.space
        const offset = parallax.space * props.offset + targetScroll * props.speed
        const toValue = parseFloat(-(parallax.current * props.speed) + offset)
        this.animatedTranslate = new Animated.Value(toValue)
        this.animatedSpace = new Animated.Value(parallax.space * props.factor)
    }

    componentDidMount() {
        const parent = this.context.parallax
        if (parent) {
            parent.layers = parent.layers.concat(this)
            parent.update()
        }
    }

    componentWillUnmount() {
        const parent = this.context.parallax
        if (parent) {
            parent.layers = parent.layers.filter(layer => layer !== this)
            parent.update()
        }
    }

    setPosition(height, scrollTop, immediate = false) {
        const targetScroll = Math.floor(this.props.offset) * height
        const offset = height * this.props.offset + targetScroll * this.props.speed
        const toValue = parseFloat(-(scrollTop * this.props.speed) + offset)
        if (!immediate) this.context.parallax.props.effect(this.animatedTranslate, toValue).start()
        else this.animatedTranslate.setValue(toValue)
    }

    setHeight(height, immediate = false) {
        const toValue = parseFloat(height * this.props.factor)
        if (!immediate) this.context.parallax.props.effect(this.animatedSpace, toValue).start()
        else this.animatedSpace.setValue(toValue)
    }

    render() {
        const { style, children, offset, speed, factor, className, ...props } = this.props
        const horizontal = this.context.parallax.props.horizontal
        const translate3d = this.animatedTranslate.interpolate({
            inputRange: [0, 1],
            outputRange: horizontal ? ['0px,0,0', '1px,0,0'] : ['0,0px,0', '0,1px,0'],
        })

        return (
            <Animated.div
                {...props}
                ref="layer"
                className={className}
                style={{
                    position: 'absolute',
                    backgroundSize: 'auto',
                    backgroundRepeat: 'no-repeat',
                    willChange: 'transform',
                    [horizontal ? 'height' : 'width']: '100%',
                    [horizontal ? 'width' : 'height']: this.animatedSpace,
                    WebkitTransform: [{ translate3d }],
                    MsTransform: [{ translate3d }],
                    transform: [{ translate3d }],
                    ...style,
                }}>
                {children}
            </Animated.div>
        )
    }
}

export class Parallax extends React.Component {
    static propTypes = {
        pages: PropTypes.number.isRequired,
        effect: PropTypes.func,
        scrolling: PropTypes.bool,
        horizontal: PropTypes.bool,
    }

    static defaultProps = {
        effect: (animation, toValue) => Animated.spring(animation, { toValue }),
        scrolling: true,
        horizontal: false,
    }
    
    static childContextTypes = { parallax: PropTypes.object }

    constructor(props) {
        super(props)
        this.state = { ready: false }
        this.layers = []
        this.space = 0
        this.current = 0
        this.offset = 0
        this.busy = false

        // refs
        this.containerRef = React.createRef();
        this.contentRef = React.createRef();
    }

    moveItems = () => {
        this.layers.forEach(layer => layer.setPosition(this.space, this.current))
        this.busy = false
    }

    scrollerRaf = () => window.requestAnimationFrame(this.moveItems)

    onScroll = event => {
        const { horizontal } = this.props
        if (!this.busy) {
            this.busy = true
            this.scrollerRaf()
            this.current = event.target[horizontal ? 'scrollLeft' : 'scrollTop']
        }
    }

    update = () => {
        const { scrolling, horizontal } = this.props
        if (!this.containerRef.current) return
        this.space = this.containerRef.current[horizontal ? 'clientWidth' : 'clientHeight']
        if (scrolling) this.current = this.containerRef.current[horizontal ? 'scrollLeft' : 'scrollTop']
        else this.containerRef.current[horizontal ? 'scrollLeft' : 'scrollTop'] = this.current = this.offset * this.space
        if (this.contentRef.current)
            this.contentRef.current.style[horizontal ? 'width' : 'height'] = `${this.space * this.props.pages}px`
        this.layers.forEach(layer => {
            layer.setHeight(this.space, true)
            layer.setPosition(this.space, this.current, true)
        })
    }

    updateRaf = () => {
        requestAnimationFrame(this.update)
        // Some browsers don't fire on maximize
        setTimeout(this.update, 150)
    }

    scrollStop = event => this.animatedScroll && this.animatedScroll.stopAnimation()

    scrollTo(offset) {
        const { horizontal, effect } = this.props
        this.scrollStop()
        this.offset = offset
        const target = this.containerRef.current
        this.animatedScroll = new Animated.Value(target[horizontal ? 'scrollLeft' : 'scrollTop'])
        this.animatedScroll.addListener(({ value }) => (target[horizontal ? 'scrollLeft' : 'scrollTop'] = value))
        effect(this.animatedScroll, offset * this.space).start()
    }

    getChildContext() {
        return { parallax: this }
    }

    componentDidMount() {
        window.addEventListener('resize', this.updateRaf, false)
        this.update()
        this.setState({ ready: true })
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.updateRaf, false)
    }

    componentDidUpdate() {
        this.update()
    }

    render() {
        const { style, innerStyle, pages, className, scrolling, children, horizontal } = this.props
        const overflow = scrolling ? 'scroll' : 'hidden'
        return (
            <div
                ref={this.containerRef}
                onScroll={this.onScroll}
                onWheel={scrolling ? this.scrollStop : null}
                onTouchStart={scrolling ? this.scrollStop : null}
                style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    overflow,
                    overflowY: horizontal ? 'hidden' : overflow,
                    overflowX: horizontal ? overflow : 'hidden',
                    WebkitOverflowScrolling: 'touch',
                    WebkitTransform: 'translate(0,0)',
                    MsTransform: 'translate(0,0)',
                    transform: 'translate3d(0,0,0)',
                    ...style,
                }}
                className={className}>
                {this.state.ready && (
                    <div
                        ref={this.contentRef.current}
                        style={{
                            position: 'absolute',
                            [horizontal ? 'height' : 'width']: '100%',
                            WebkitTransform: 'translate(0,0)',
                            MsTransform: 'translate(0,0)',
                            transform: 'translate3d(0,0,0)',
                            overflow: 'hidden',
                            [horizontal ? 'width' : 'height']: this.space * pages,
                            ...innerStyle,
                        }}>
                        {children}
                    </div>
                )}
            </div>
        )
    }
}