// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
// License: GNU General Public License v3. See license.txt
function close_tab() {
    window.open('', '_self', '');
    window.close();
}
// JS exclusive to /cart page
frappe.provide("erpnext.e_commerce.shopping_cart");
var shopping_cart = erpnext.e_commerce.shopping_cart;

$.extend(shopping_cart, {

	show_error: function(title, text) {
		$("#cart-container").html('<div class="msg-box"><h4>' +
			title + '</h4><p class="text-muted">' + text + '</p></div>');
	},

	bind_events: function() {
		shopping_cart.bind_address_picker_dialog();
		shopping_cart.bind_place_order();
		shopping_cart.bind_request_quotation();
		shopping_cart.bind_change_qty();
		shopping_cart.bind_remove_cart_item();
		shopping_cart.bind_change_notes();
		shopping_cart.bind_coupon_code();
	},

	bind_address_picker_dialog: function() {
		const d = this.get_update_address_dialog();
		this.parent.find('.btn-change-address').on('click', (e) => {
			const type = $(e.currentTarget).parents('.address-container').attr('data-address-type');
			$(d.get_field('address_picker').wrapper).html(
				this.get_address_template(type)
			);
			d.show();
		});
	},

	get_update_address_dialog() {
		let d = new frappe.ui.Dialog({
			title: "Select Address",
			fields: [{
				'fieldtype': 'HTML',
				'fieldname': 'address_picker',
			}],
			primary_action_label: __('Set Address'),
			primary_action: () => {
				const $card = d.$wrapper.find('.address-card.active');
				const address_type = $card.closest('[data-address-type]').attr('data-address-type');
				const address_name = $card.closest('[data-address-name]').attr('data-address-name');
				frappe.call({
					type: "POST",
					method: "erpnext.e_commerce.shopping_cart.cart.update_cart_address",
					freeze: true,
					args: {
						address_type,
						address_name
					},
					callback: function(r) {
						d.hide();
						if (!r.exc) {
							$(".cart-tax-items").html(r.message.total);
							shopping_cart.parent.find(
								`.address-container[data-address-type="${address_type}"]`
							).html(r.message.address);
						}
					}
				});
			}
		});

		return d;
	},

	get_address_template(type) {
		return {
			shipping: `<div class="mb-3" data-section="shipping-address">
				<div class="row no-gutters" data-fieldname="shipping_address_name">
					{% for address in shipping_addresses %}
						<div class="mr-3 mb-3 w-100" data-address-name="{{address.name}}" data-address-type="shipping"
							{% if doc.shipping_address_name == address.name %} data-active {% endif %}>
							{% include "templates/includes/cart/address_picker_card.html" %}
						</div>
					{% endfor %}
				</div>
			</div>`,
			billing: `<div class="mb-3" data-section="billing-address">
				<div class="row no-gutters" data-fieldname="customer_address">
					{% for address in billing_addresses %}
						<div class="mr-3 mb-3 w-100" data-address-name="{{address.name}}" data-address-type="billing"
							{% if doc.shipping_address_name == address.name %} data-active {% endif %}>
							{% include "templates/includes/cart/address_picker_card.html" %}
						</div>
					{% endfor %}
				</div>
			</div>`,
		}[type];
	},

	bind_place_order: function() {
		$(".btn-place-order").on("click", function() {
			shopping_cart.place_order(this);
		});
	},
	//
	bind_request_quotation: function() {
		$('.btn-request-for-quotation').on('click', function() {
			frappe.call({
				method: 'frappe.client.get_list',
				args: {
					doctype: 'Department',
					fields: ['name', 'department_name'],
				},
				callback: function(response) {
					var options = [];
					if (response && response.message) {
						response.message.forEach(function(department) {
							options.push({label: department.department_name, value: department.name});
						});
					}
					// set the options for the department field
					var dialog = new frappe.ui.Dialog({
						title: 'eSARF Request',
						fields: [
							{
								label: 'Employee Receiving Equipment (Enter Full Name)',
								fieldname: 'full_name',
								fieldtype: 'Data',
								reqd: true
							},
							{
								label: 'New Employee?',
								fieldname: 'new_employee',
								fieldtype: 'Check',
								onchange: function() {
									// show or hide the email field based on the checkbox state
									var email_field = dialog.get_field('email');
									email_field.df.hidden = this.get_value();
									// make it required if it's visible
									email_field.df.reqd = !email_field.df.hidden;
									email_field.refresh();
								}
							},
							{
								label: 'Receiver Email Address',
								fieldname: 'email',
								fieldtype: 'Data',
								reqd: 1,
								hidden: 0
							},
							{
								label: 'Department',
								fieldname: 'department',
								fieldtype: 'Select',
								options: options,
								reqd: true,
							},
							{
								label: 'Date Needed',
								fieldname: 'date_needed',
								fieldtype: 'Date',
								reqd: false,
							},
						],
						primary_action_label: 'Submit',
						primary_action(values) {
							console.log(values.full_name, values.email, values.department, values.date_needed);
							var full_name = values.full_name;
							var anc_email = values.email;
							var department = values.department;
							var date_needed = values.date_needed;
							var new_employee = values.new_employee;

							if(values.new_employee) {
								new_employee = 1;
							} else {
								new_employee = 0;
							}
							// set the employee_name in quotation doctype recent record to the full_name update the database directly
							//first get the name of the latest quotation belongs to the current user
							frappe.call({
	
								method: "frappe.client.get_list",
								args: {
									doctype: "Quotation",
									fields: ["name", "party_name"],
									filters: {
										"party_name": frappe.session.user_fullname
									},
									order_by: "creation desc",
									limit_page_length: 1
								},
								callback: function (r) {
									//update the employee_name field in the quotation doctype then set those fields to read only
									frappe.call({
										method: "frappe.client.set_value",
										args: {
											doctype: "Quotation",
											name: r.message[0].name,
											fieldname: {"employee_name": full_name, "employee_email": anc_email, "department": department, "date_needed": date_needed, "new_employee": new_employee},
										},
										callback: function() {
											// call the shopping_cart.request_quotation() function inside the frappe.call() callback
											shopping_cart.request_quotation(this);
											dialog.hide();
											var message = "<p>Request Sent, you can close this window now.</p>";
                   							message += "<button class='btn btn-primary btn-sm' onclick='close_tab()'>Close Tab</button>&nbsp;"; // add a button to close the tab
											message += "<a href='/home'><button class='btn btn-primary btn-sm'>Go Home</button></a>"; // add a button to go to the home page
											frappe.msgprint(message); // show the success message
										}
									});
									
								}
							});
							frappe.show_alert('Quotation request submitted successfully!');

                        // redirect the user to a different page
                        	//window.location.href = 'http://10.12.5.62:8000/home';
						}
					});
					dialog.show();
				}
			});
		});
	},
	

	bind_change_qty: function() {
		// bind update button
		$(".cart-items").on("change", ".cart-qty", function() {
			var item_code = $(this).attr("data-item-code");
			var newVal = $(this).val();
			shopping_cart.shopping_cart_update({item_code, qty: newVal});
		});

		$(".cart-items").on('click', '.number-spinner button', function () {
			var btn = $(this),
				input = btn.closest('.number-spinner').find('input'),
				oldValue = input.val().trim(),
				newVal = 0;

			if (btn.attr('data-dir') == 'up') {
				newVal = parseInt(oldValue) + 1;
			} else {
				if (oldValue > 1) {
					newVal = parseInt(oldValue) - 1;
				}
			}
			input.val(newVal);

			let notes = input.closest("td").siblings().find(".notes").text().trim();
			var item_code = input.attr("data-item-code");
			shopping_cart.shopping_cart_update({
				item_code,
				qty: newVal,
				additional_notes: notes
			});
		});
	},

	bind_change_notes: function() {
		$('.cart-items').on('change', 'textarea', function() {
			const $textarea = $(this);
			const item_code = $textarea.attr('data-item-code');
			const qty = $textarea.closest('tr').find('.cart-qty').val();
			const notes = $textarea.val();
			shopping_cart.shopping_cart_update({
				item_code,
				qty,
				additional_notes: notes
			});
		});
	},

	bind_remove_cart_item: function() {
		$(".cart-items").on("click", ".remove-cart-item", (e) => {
			const $remove_cart_item_btn = $(e.currentTarget);
			var item_code = $remove_cart_item_btn.data("item-code");

			shopping_cart.shopping_cart_update({
				item_code: item_code,
				qty: 0
			});
		});
	},

	render_tax_row: function($cart_taxes, doc, shipping_rules) {
		var shipping_selector;
		if(shipping_rules) {
			shipping_selector = '<select class="form-control">' + $.map(shipping_rules, function(rule) {
				return '<option value="' + rule[0] + '">' + rule[1] + '</option>' }).join("\n") +
			'</select>';
		}

		var $tax_row = $(repl('<div class="row">\
			<div class="col-md-9 col-sm-9">\
				<div class="row">\
					<div class="col-md-9 col-md-offset-3">' +
					(shipping_selector || '<p>%(description)s</p>') +
					'</div>\
				</div>\
			</div>\
			<div class="col-md-3 col-sm-3 text-right">\
				<p' + (shipping_selector ? ' style="margin-top: 5px;"' : "") + '>%(formatted_tax_amount)s</p>\
			</div>\
		</div>', doc)).appendTo($cart_taxes);

		if(shipping_selector) {
			$tax_row.find('select option').each(function(i, opt) {
				if($(opt).html() == doc.description) {
					$(opt).attr("selected", "selected");
				}
			});
			$tax_row.find('select').on("change", function() {
				shopping_cart.apply_shipping_rule($(this).val(), this);
			});
		}
	},

	apply_shipping_rule: function(rule, btn) {
		return frappe.call({
			btn: btn,
			type: "POST",
			method: "erpnext.e_commerce.shopping_cart.cart.apply_shipping_rule",
			args: { shipping_rule: rule },
			callback: function(r) {
				if(!r.exc) {
					shopping_cart.render(r.message);
				}
			}
		});
	},

	place_order: function(btn) {
		shopping_cart.freeze();

		return frappe.call({
			type: "POST",
			method: "erpnext.e_commerce.shopping_cart.cart.place_order",
			btn: btn,
			callback: function(r) {
				if(r.exc) {
					shopping_cart.unfreeze();
					var msg = "";
					if(r._server_messages) {
						msg = JSON.parse(r._server_messages || []).join("<br>");
					}

					$("#cart-error")
						.empty()
						.html(msg || frappe._("Something went wrong!"))
						.toggle(true);
				} else {
					$(btn).hide();
					window.location.href = '/orders/' + encodeURIComponent(r.message);
				}
			}
		});
	},

	request_quotation: function(btn) {
		shopping_cart.freeze();
		return frappe.call({
			type: "POST",
			method: "erpnext.e_commerce.shopping_cart.cart.request_for_quotation",
			btn: btn,
			callback: function(r) {
				if(r.exc) {
					shopping_cart.unfreeze();
					
					var msg = "";
					if(r._server_messages) {
						msg = JSON.parse(r._server_messages || []).join("<br>");
					}

					$("#cart-error")
						.empty()
						.html(msg || frappe._("Something went wrong!"))
						.toggle(true);
				} else {
					$(btn).hide();
					//window.location.href = '/orders/' + encodeURIComponent(r.message);
				}
			}
		});
	},

	bind_coupon_code: function() {
		$(".bt-coupon").on("click", function() {
			shopping_cart.apply_coupon_code(this);
		});
	},

	apply_coupon_code: function(btn) {
		return frappe.call({
			type: "POST",
			method: "erpnext.e_commerce.shopping_cart.cart.apply_coupon_code",
			btn: btn,
			args : {
				applied_code : $('.txtcoupon').val(),
				applied_referral_sales_partner: $('.txtreferral_sales_partner').val()
			},
			callback: function(r) {
				if (r && r.message){
					location.reload();
				}
			}
		});
	}
});

frappe.ready(function() {
	if (window.location.pathname === "/cart") {
		$(".cart-icon").hide();
	}
	shopping_cart.parent = $(".cart-container");
	shopping_cart.bind_events();
});

function show_terms() {
	var html = $(".cart-terms").html();
	frappe.msgprint(html);
}
