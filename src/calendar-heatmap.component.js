import * as React from 'react'

import moment from 'moment'
import * as d3 from 'd3'

import styles from './calendar-heatmap.css'

class CalendarHeatmap extends React.Component {

  constructor(props) {
	super(props)

	this.settings = {
	  gutter: 5,
	  item_gutter: 1,
	  width: 1000,
	  height: 200,
	  item_size: 10,
	  label_padding: 40,
	  max_block_height: 20,
	  transition_duration: 500,
	  tooltip_width: 250,
	  tooltip_padding: 15,
	}

	this.in_transition = false
	this.selected = {}

	this.calcDimensions = this.calcDimensions.bind(this)
  }

  componentDidMount() {
	this.createElements()
	this.parseData()
	this.drawChart()

	window.addEventListener('resize', this.calcDimensions)
  }

  componentWillUnmount() {
	window.removeEventListener('resize', this.calcDimensions)
  }

  createElements() {
	// Create svg element
	this.svg = d3.select('#calendar-heatmap')
	  .append('svg')
	  .attr('class', 'svg')

	// Create other svg elements
	this.items = this.svg.append('g')
	this.labels = this.svg.append('g')
	this.buttons = this.svg.append('g')

	// Add tooltip to the same element as main svg
	this.tooltip = d3.select('#calendar-heatmap')
	  .append('div')
	  .attr('class', styles.heatmapTooltip)
	  .style('opacity', 0)
	  .style('pointer-events', 'none')
	  .style('position', 'absolute')
	  .style('z-index', 9999)
	  .style('width', '250px')
	  .style('max-width', '250px')
	  .style('overflow', 'hidden')
	  .style('padding', '15px')
	  .style('font-size', '12px')
	  .style('line-height', '14px')
	  .style('color', 'rgb(51, 51, 51)')
	  .style('background', 'rgba(255, 255, 255, 0.75)')

	this.calcDimensions()
  }

  // Calculate dimensions based on available width
  calcDimensions() {
	let dayIndex = Math.round((moment() - moment().subtract(1, 'year').startOf('week')) / 86400000)
	let colIndex = Math.trunc(dayIndex / 7)
	let numWeeks = colIndex + 1

	this.settings.width = this.container.offsetWidth < 1000 ? 1000 : this.container.offsetWidth
	this.settings.item_size = ((this.settings.width - this.settings.label_padding) / numWeeks - this.settings.gutter)
	this.settings.height = this.settings.label_padding + 7 * (this.settings.item_size + this.settings.gutter)
	this.svg.attr('width', this.settings.width)
	  .attr('height', this.settings.height)

	if ( !!this.props.data && !!this.props.data[0].summary ) {
	  this.drawChart()
	}
  }

  parseData() {
	if ( !this.props.data ) { return }

	// Get daily summary if that was not provided
	if ( !this.props.data[0].summary ) {
	  this.props.data.map(d => {
		let summary = d.details.reduce((uniques, project) => {
		  if (!uniques[project.name]) {
			uniques[project.name] = {
			  'value': project.value
			}
		  } else {
			uniques[project.name].value += project.value
		  }
		  return uniques
		}, {})
		let unsorted_summary = Object.keys(summary).map(key => {
		  return {
			'name': key,
			'value': summary[key].value
		  }
		})
		d.summary = unsorted_summary.sort((a, b) => {
		  return b.value - a.value
		})
		return d
	  })
	}
  }

  /**
   * Draw year overview
   */
  drawChart() {
	// Define start and end date of the selected year
	let start_of_year = moment(this.selected.date).startOf('year')
	let end_of_year = moment(this.selected.date).endOf('year')

	// Filter data down to the selected year
	let year_data = this.props.data.filter(d => {
	  return start_of_year <= moment(d.date) && moment(d.date) < end_of_year
	})

	// Calculate max value of the year data
	let max_value = d3.max(year_data, d => d.total)

	let color = d3.scaleLinear()
	  .range(['#ffffff', this.props.color])
	  .domain([-0.15 * max_value, max_value])

	let calcItemX = (d) => {
	  let date = moment(d.date)
	  let dayIndex = Math.round((date - moment(start_of_year).startOf('week')) / 86400000)
	  let colIndex = Math.trunc(dayIndex / 7)
	  return colIndex * (this.settings.item_size + this.settings.gutter) + this.settings.label_padding
	}

	let calcItemY = d => {
	  return this.settings.label_padding + moment(d.date).weekday() * (this.settings.item_size + this.settings.gutter)
	}

	let calcItemSize = d => {
	  if ( max_value <= 0 ) {
		return this.settings.item_size
	  }
	  return this.settings.item_size * 0.75 + (this.settings.item_size * d.total / max_value) * 0.25
	}

	this.items.selectAll('.item-circle').remove()
	this.items.selectAll('.item-circle')
	  .data(year_data)
	  .enter()
	  .append('rect')
	  .attr('class', 'item item-circle')
	  .style('cursor', 'pointer')
	  .style('opacity', 0)
	  .attr('x', d => {
		return calcItemX(d) + (this.settings.item_size - calcItemSize(d)) / 2
	  })
	  .attr('y', d => {
		return calcItemY(d) + (this.settings.item_size - calcItemSize(d)) / 2
	  })
	  .attr('rx', d => {
		return calcItemSize(d)
	  })
	  .attr('ry', d => {
		return calcItemSize(d)
	  })
	  .attr('width', d => {
		return calcItemSize(d)
	  })
	  .attr('height', d => {
		return calcItemSize(d)
	  })
	  .attr('fill', d => {
		return (d.total > 0) ? color(d.total) : 'transparent'
	  })
	  .on('mouseover', d => {
		if (this.in_transition) { return }

		// Pulsating animation
		let circle = d3.select(d3.event.currentTarget)
		let repeat = () => {
		  circle = circle.transition()
			.duration(this.settings.transition_duration)
			.ease(d3.easeLinear)
			.attr('x', d => {
			  return calcItemX(d) - (this.settings.item_size * 1.1 - this.settings.item_size) / 2
			})
			.attr('y', d => {
			  return calcItemY(d) - (this.settings.item_size * 1.1 - this.settings.item_size) / 2
			})
			.attr('width', this.settings.item_size * 1.1)
			.attr('height', this.settings.item_size * 1.1)
			.transition()
			.duration(this.settings.transition_duration)
			.ease(d3.easeLinear)
			.attr('x', d => {
			  return calcItemX(d) + (this.settings.item_size - calcItemSize(d)) / 2
			})
			.attr('y', d => {
			  return calcItemY(d) + (this.settings.item_size - calcItemSize(d)) / 2
			})
			.attr('width', d => {
			  return calcItemSize(d)
			})
			.attr('height', d => {
			  return calcItemSize(d)
			})
			.on('end', repeat)
		}
		repeat()

		// Construct tooltip
		let tooltip_html = ''
		tooltip_html += `<div class="${styles.header}"><strong>${d.total ? this.formatTime(d.total) : 'No time'} tracked</strong></div>`
		tooltip_html += '<div>on ' + moment(d.date).format('dddd, MMM Do YYYY') + '</div><br>'

		// Add summary to the tooltip
		let counter = 0
		while ( counter < d.summary.length ) {
		  tooltip_html += '<div><span><strong>' + d.summary[counter].name + '</strong></span>'
		  tooltip_html += '<span>' + this.formatTime(d.summary[counter].value) + '</span></div>'
		  counter++
		}

		// Calculate tooltip position
		let x = calcItemX(d) + this.settings.item_size
		if (this.settings.width - x < (this.settings.tooltip_width + this.settings.tooltip_padding * 3)) {
		  x -= this.settings.tooltip_width + this.settings.tooltip_padding * 2
		}
		let y = calcItemY(d) + this.settings.item_size

		// Show tooltip
		this.tooltip.html(tooltip_html)
		  .style('left', x + 'px')
		  .style('top', y + 'px')
		  .transition()
		  .duration(this.settings.transition_duration / 2)
		  .ease(d3.easeLinear)
		  .style('opacity', 1)
	  })
	  .on('mouseout', () => {
		if (this.in_transition) { return }

		// Set circle radius back to what its supposed to be
		d3.select(d3.event.currentTarget).transition()
		  .duration(this.settings.transition_duration / 2)
		  .ease(d3.easeLinear)
		  .attr('x', d => {
			return calcItemX(d) + (this.settings.item_size - calcItemSize(d)) / 2
		  })
		  .attr('y', d => {
			return calcItemY(d) + (this.settings.item_size - calcItemSize(d)) / 2
		  })
		  .attr('width', d => {
			return calcItemSize(d)
		  })
		  .attr('height', d => {
			return calcItemSize(d)
		  })

		// Hide tooltip
		this.hideTooltip()
	  })
	  .transition()
	  .delay(() => {
		return (Math.cos(Math.PI * Math.random()) + 1) * this.settings.transition_duration
	  })
	  .duration(() => {
		return this.settings.transition_duration
	  })
	  .ease(d3.easeLinear)
	  .style('opacity', 1)
	  .call((transition, callback) => {
		if (transition.empty()) {
		  callback()
		}
		let n = 0
		transition
		  .each(() => ++n)
		  .on('end', function() {
			if (!--n) {
			  callback.apply(this, arguments)
			}
		  })
	  }, () => {
		this.in_transition = false
	  })

	// Add month labels
	let month_labels = d3.timeMonths(start_of_year, end_of_year)
	let monthScale = d3.scaleLinear()
	  .range([0, this.settings.width])
	  .domain([0, month_labels.length])
	this.labels.selectAll('.label-month').remove()
	this.labels.selectAll('.label-month')
	  .data(month_labels)
	  .enter()
	  .append('text')
	  .attr('class', 'label label-month')
	  .style('cursor', 'pointer')
	  .style('fill', 'rgb(170, 170, 170)')
	  .attr('font-size', () => {
		return Math.floor(this.settings.label_padding / 3) + 'px'
	  })
	  .text(d => {
		return d.toLocaleDateString('en-us', { month: 'short' })
	  })
	  .attr('x', (d, i) => {
		return monthScale(i) + (monthScale(i) - monthScale(i - 1)) / 2
	  })
	  .attr('y', this.settings.label_padding / 2)
	  .on('mouseenter', d => {
		if (this.in_transition) { return }

		let selected_month = moment(d)
		this.items.selectAll('.item-circle')
		  .transition()
		  .duration(this.settings.transition_duration)
		  .ease(d3.easeLinear)
		  .style('opacity', d => {
			return moment(d.date).isSame(selected_month, 'month') ? 1 : 0.1
		  })
	  })
	  .on('mouseout', () => {
		if (this.in_transition) { return }

		this.items.selectAll('.item-circle')
		  .transition()
		  .duration(this.settings.transition_duration)
		  .ease(d3.easeLinear)
		  .style('opacity', 1)
	  })

	// Add day labels
	let day_labels = d3.timeDays(moment().startOf('week'), moment().endOf('week'))
	let dayScale = d3.scaleBand()
	  .rangeRound([this.settings.label_padding, this.settings.height])
	  .domain(day_labels.map(d => {
		return moment(d).weekday()
	  }))
	this.labels.selectAll('.label-day').remove()
	this.labels.selectAll('.label-day')
	  .data(day_labels)
	  .enter()
	  .append('text')
	  .attr('class', 'label label-day')
	  .style('cursor', 'pointer')
	  .style('fill', 'rgb(170, 170, 170)')
	  .attr('x', this.settings.label_padding / 3)
	  .attr('y', (d, i) => {
		return dayScale(i) + dayScale.bandwidth() / 1.75
	  })
	  .style('text-anchor', 'left')
	  .attr('font-size', () => {
		return Math.floor(this.settings.label_padding / 3) + 'px'
	  })
	  .text(d => {
		return moment(d).format('dddd')[0]
	  })
	  .on('mouseenter', d => {
		if (this.in_transition) { return }

		let selected_day = moment(d)
		this.items.selectAll('.item-circle')
		  .transition()
		  .duration(this.settings.transition_duration)
		  .ease(d3.easeLinear)
		  .style('opacity', d => {
			return (moment(d.date).day() === selected_day.day()) ? 1 : 0.1
		  })
	  })
	  .on('mouseout', () => {
		if (this.in_transition) { return }

		this.items.selectAll('.item-circle')
		  .transition()
		  .duration(this.settings.transition_duration)
		  .ease(d3.easeLinear)
		  .style('opacity', 1)
	  })

	// Add button to switch back to previous overview
	this.drawButton()
  }

  /**
   * Helper function to hide the tooltip
   */
  hideTooltip() {
	this.tooltip.transition()
	  .duration(this.settings.transition_duration / 2)
	  .ease(d3.easeLinear)
	  .style('opacity', 0)
  }

  /**
   * Helper function to convert seconds to a human readable format
   * @param seconds Integer
   */
  formatTime(seconds) {
	let hours = Math.floor(seconds / 3600)
	let minutes = Math.floor((seconds - (hours * 3600)) / 60)
	let time = ''
	if (hours > 0) {
	  time += hours === 1 ? '1 hour ' : hours + ' hours '
	}
	if (minutes > 0) {
	  time += minutes === 1 ? '1 minute' : minutes + ' minutes'
	}
	if (hours === 0 && minutes === 0) {
	  time = Math.round(seconds) + ' seconds'
	}
	return time
  }


  render() {
	return (
	  <div id='calendar-heatmap'
		className={styles.calendarHeatmap}
		ref={elem => {this.container = elem}}>
	  </div>
	)
  }
}

CalendarHeatmap.defaultProps = {
  data: [],
  color: '#ff4500'
}

export default CalendarHeatmap
